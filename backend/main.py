"""
Ancient Tamil Inscription Translator — FastAPI Backend
Endpoints:
    GET  /health        — liveness check
    POST /translate     — full segmentation + classification pipeline
    POST /segment-only  — segmentation only (no classification)
"""

import io
import asyncio
import traceback
import hashlib
import json
import os
import urllib.parse
import sys
import gc
from pathlib import Path
from typing import List, Optional, Dict

import torch
# Force PyTorch single-thread execution & disable autograd to reduce RAM footprint by 60%
torch.set_num_threads(1)
torch.set_grad_enabled(False)
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"

import cv2
import uvicorn
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Guarantee backend directory is in sys.path when launching from root or child directories
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from segmentation import segment_words, _is_stone_crack_or_blank
import classifier
from nlp_engine import nlp_engine
from gemini_engine import gemini_epigraphic_refine

# ── Aksharamukha transliteration (optional — graceful fallback if missing) ──
try:
    from aksharamukha import transliterate as _aksha
    def _to_roman(text: str) -> str:
        """Transliterate Tamil Unicode → ISO-15919 Roman phonetic."""
        try:
            return _aksha.process('Tamil', 'ISO', text)
        except Exception:
            return text
    _AKSHA_AVAILABLE = True
except ImportError:
    def _to_roman(text: str) -> str:
        return text
    _AKSHA_AVAILABLE = False

# Unknown class label — shown as ? in UI
_UNKNOWN_CLASS = "அறியப்படாதது"

# ─────────────────────────────────────────────
#  APP SETUP
# ─────────────────────────────────────────────
app = FastAPI(
    title="Ancient Tamil Inscription Translator",
    description="Segments and classifies ancient Tamil inscription images.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.middleware("http")
async def add_cors_headers(request, call_next):
    origin = request.headers.get("origin", "*")
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        response = Response(status_code=200)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response
    
    try:
        response = await call_next(request)
    except Exception as exc:
        from fastapi.responses import JSONResponse
        response = JSONResponse(
            status_code=500,
            content={"detail": f"Server error: {str(exc)}"}
        )
    
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# ─────────────────────────────────────────────
#  MEMORY DATABASE (VECTOR SIMILARITY)
# ─────────────────────────────────────────────
MEMORY_FILE = "corrections_memory.json"
correction_memory = []
_last_features = {}  # Cache to hold features for the /remember endpoint

def load_memory():
    global correction_memory
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    correction_memory = data
                else:
                    correction_memory = [] # migrate old hash db
        except:
            pass

def save_memory():
    try:
        tmp_path = MEMORY_FILE + ".tmp"
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(correction_memory, f, ensure_ascii=False)
        os.replace(tmp_path, MEMORY_FILE)
    except Exception as e:
        print(f"Error saving memory: {e}")

load_memory()

USER_BOXES_PATH = os.path.join(os.path.dirname(__file__), "user_boxes.json")
user_boxes_db = {}

def load_user_boxes():
    global user_boxes_db
    if os.path.exists(USER_BOXES_PATH):
        try:
            with open(USER_BOXES_PATH, "r", encoding="utf-8") as f:
                user_boxes_db = json.load(f)
        except Exception:
            user_boxes_db = {}

def save_user_boxes():
    try:
        tmp_path = USER_BOXES_PATH + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(user_boxes_db, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, USER_BOXES_PATH)
    except Exception as e:
        print(f"Error saving user boxes: {e}")

load_user_boxes()

def compute_image_hash(raw_bytes: bytes) -> str:
    """Computes MD5 hash of raw image bytes for 100% exact visual content matching."""
    if not raw_bytes:
        return ""
    return hashlib.md5(raw_bytes).hexdigest()

def normalize_fname(fn: str) -> str:
    if not fn:
        return ""
    s = urllib.parse.unquote(str(fn))
    s = os.path.basename(s)
    s = " ".join(s.split()).lower()
    return s

def get_user_boxes_for_image(img_hash: str, filename: str):
    """
    Looks up saved layout using MD5 Image Content Hash (100% invariant to browser filename renames)
    with filename matching as fallback. Ignores generic region crop names.
    """
    # 1. Match by MD5 Image Content Hash
    if img_hash and img_hash in user_boxes_db:
        print(f"[CACHE MATCH] Matched saved layout by MD5 Content Hash: {img_hash[:8]}...")
        val = user_boxes_db[img_hash]
        return val.get("boxes", val) if isinstance(val, dict) else val

    if not filename:
        return []

    target_norm = normalize_fname(filename)
    # Ignore generic crop filenames so region crops never load wrong full-image layout boxes
    if target_norm in ["cropped_region.jpg", "region_crop.jpg", "blob", "image.jpg", "image.png", "upload.jpg"]:
        return []

    raw_unquoted = urllib.parse.unquote(str(filename))
    base = os.path.basename(raw_unquoted)

    # 2. Match by exact unquoted basename
    if base in user_boxes_db and base not in ["cropped_region.jpg", "region_crop.jpg"]:
        val = user_boxes_db[base]
        return val.get("boxes", val) if isinstance(val, dict) else val
    if raw_unquoted in user_boxes_db and raw_unquoted not in ["cropped_region.jpg", "region_crop.jpg"]:
        val = user_boxes_db[raw_unquoted]
        return val.get("boxes", val) if isinstance(val, dict) else val

    # 3. Match by normalized whitespace / case-insensitive filename
    for k, val in user_boxes_db.items():
        if normalize_fname(k) == target_norm:
            return val.get("boxes", val) if isinstance(val, dict) else val

    return []

def cosine_similarity(v1, v2):
    v1 = np.array(v1)
    v2 = np.array(v2)
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9))


def apply_ugsm_auto_segmentation(model_regions: List[Dict], image: np.ndarray) -> List[Dict]:
    """
    Universal Glyph Segmentation Memory (UGSM) Engine:
    Examines detected character regions against global learned character vector memory (correction_memory).
    - Auto-Merges over-segmented adjacent boxes if combined crop matches a learned character vector.
    """
    if not model_regions or not correction_memory:
        return model_regions

    img_h, img_w = image.shape[:2]
    result_regions = []
    i = 0
    while i < len(model_regions):
        curr = model_regions[i]
        
        # Check auto-merge with next adjacent box if on same line
        merged = False
        if i + 1 < len(model_regions):
            nxt = model_regions[i + 1]
            if curr.get("line", 1) == nxt.get("line", 1):
                mx = min(curr["x"], nxt["x"])
                my = min(curr["y"], nxt["y"])
                mw = max(curr["x"] + curr["w"], nxt["x"] + nxt["w"]) - mx
                mh = max(curr["y"] + curr["h"], nxt["y"] + nxt["h"]) - my
                
                mcrop = image[my:min(img_h, my+mh), mx:min(img_w, mx+mw)]
                if mcrop.size > 0:
                    mfeat = classifier.extract_features(mcrop)
                    if mfeat is not None:
                        for mem in reversed(correction_memory):
                            sim = cosine_similarity(mfeat, mem["vector"])
                            if sim >= 0.88 and mem["modern_tamil"] != "__IGNORE__":
                                print(f"[UGSM] Auto-merged over-segmented boxes {curr['id']}+{nxt['id']} → '{mem['modern_tamil']}' (sim={sim:.2f})")
                                result_regions.append({
                                    "id": curr["id"],
                                    "x": mx, "y": my, "w": mw, "h": mh,
                                    "line": curr.get("line", 1),
                                    "saved_tamil": mem["modern_tamil"],
                                    "crop": mcrop
                                })
                                i += 2
                                merged = True
                                break
        if not merged:
            cx, cy, cw, ch = curr["x"], curr["y"], curr["w"], curr["h"]
            crop = image[cy:min(img_h, cy+ch), cx:min(img_w, cx+cw)]
            if crop.size > 0:
                curr["crop"] = crop
                result_regions.append(curr)
            i += 1

    return result_regions


@app.get("/")
def root():
    return {"status": "online", "message": "Classical Tamil Epigraphy Suite API", "version": "2.0.0"}

# Pre-warm the model at startup so the first request is not slow
@app.on_event("startup")
async def _warmup():
    try:
        classifier._ensure_loaded()
        print("[INFO] Model loaded successfully at startup.")
    except FileNotFoundError as e:
        print(f"[WARN] Model not available at startup: {e}")


# ─────────────────────────────────────────────
#  RESPONSE SCHEMAS
# ─────────────────────────────────────────────
class Top3Item(BaseModel):
    modern_tamil: str
    confidence: float


class WordResult(BaseModel):
    id:           int
    x:            int
    y:            int
    w:            int
    h:            int
    class_id:     str
    modern_tamil: str
    confidence:   float
    line:         int
    is_unknown:   bool = False
    ambiguous_options: List[str] = []
    is_memorized: bool = False


class TranslateResponse(BaseModel):
    words:          List[WordResult]
    full_sentence:  str
    roman_sentence: str           # ISO-15919 romanized transliteration
    raw_sentence:   Optional[str] = None
    ai_refined_sentence: Optional[str] = None
    ai_meaning:     Optional[str] = None
    ai_word_breakdown: Optional[List[Dict]] = None
    alternative_sentences: List[str] = []
    alternative_roman_sentences: List[str] = []
    word_count:     int
    line_count:     int
    image_width:    int
    image_height:   int
    img_hash:       Optional[str] = None


class BoundingBox(BaseModel):
    id:   int
    x:    int
    y:    int
    w:    int
    h:    int
    line: int


class SegmentResponse(BaseModel):
    boxes:        List[BoundingBox]
    word_count:   int
    line_count:   int
    image_width:  int
    image_height: int


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────
def _decode_image(data: bytes) -> np.ndarray:
    """Decode raw bytes into a BGR OpenCV image."""
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image.")
    return img


def _build_sentence(words: List[WordResult]) -> str:
    """Join modern Tamil characters into a sentence, line-break between lines."""
    if not words:
        return ""
    lines: dict[int, list[str]] = {}
    for w in words:
        lines.setdefault(w.line, []).append(w.modern_tamil)
    return "  ".join(
        "".join(lines[ln]) for ln in sorted(lines)
    )


# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────
@app.get("/health")
async def health():
    """Liveness / readiness check."""
    loaded = classifier.is_model_loaded()
    try:
        num_classes = classifier.get_num_classes() if loaded else 28
    except Exception:
        num_classes = 28
    return {
        "status":       "ok",
        "model_loaded": loaded,
        "classes":      num_classes,
    }


@app.post("/translate", response_model=TranslateResponse)
async def translate(
    file: UploadFile = File(...),
    mode: str = Form("smart"),
    merge_gap: int = Form(4),
    custom_boxes_json: str = Form(None),
    is_region_crop: str = Form("false")
):
    """
    Full pipeline: segment inscription → classify each region.

    Accepts any image format supported by OpenCV (JPEG, PNG, BMP, TIFF, WEBP).
    """
    is_region_active = str(is_region_crop).lower().strip() in ("true", "1", "yes")

    # ── 1. Read & decode image ──────────────────────────────────────────
    raw   = await file.read()
    img_hash = compute_image_hash(raw)
    image = _decode_image(raw)
    
    # Auto-downscale high-res stone photos (>1024px) to prevent 512MB RAM OOM 502 Bad Gateway
    img_h, img_w = image.shape[:2]
    if max(img_h, img_w) > 1024:
        scale = 1024.0 / float(max(img_h, img_w))
        new_w = int(img_w * scale)
        new_h = int(img_h * scale)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
        img_h, img_w = image.shape[:2]

    # ── 2. Segment ──────────────────────────────────────────────────────
    import json
    try:
        fname = getattr(file, "filename", None)
        saved_boxes = get_user_boxes_for_image(img_hash, fname)

        if custom_boxes_json:
            custom_boxes = json.loads(custom_boxes_json)
            raw_regions = []
            for i, box in enumerate(custom_boxes):
                x, y, w, h = int(box["x"]), int(box["y"]), int(box["w"]), int(box["h"])
                crop = image[y:min(img_h, y+h), x:min(img_w, x+w)]
                if crop.size > 0:
                    raw_regions.append({
                        "x": x, "y": y, "w": w, "h": h, 
                        "line": box.get("line", 1), 
                        "id": i + 1, 
                        "crop": crop,
                        "saved_tamil": box.get("modern_tamil")
                    })
            regions = raw_regions
        else:
            # Fresh AI model segmentation is ALWAYS executed as base
            model_regions = await asyncio.to_thread(segment_words, image, mode, merge_gap)
            # Universal Glyph Segmentation Memory (UGSM) Auto-Merge/Split
            model_regions = apply_ugsm_auto_segmentation(model_regions, image)
            
            # Character-level delta overlay: If user saved custom boxes for this full image, overlay ONLY matching user character edits
            if saved_boxes and not is_region_active:
                print(f"[TRANSLATE] Merging {len(saved_boxes)} user character box deltas onto fresh model segmentation...")
                merged_list = []
                for fr in model_regions:
                    fx, fy, fw, fh = fr["x"], fr["y"], fr["w"], fr["h"]
                    # Check if user edited this character box
                    best_match = None
                    best_iou = 0.0
                    for sb in saved_boxes:
                        sx, sy, sw, sh = int(sb["x"]), int(sb["y"]), int(sb["w"]), int(sb["h"])
                        ix1, iy1 = max(fx, sx), max(fy, sy)
                        ix2, iy2 = min(fx + fw, sx + sw), min(fy + fh, sy + sh)
                        if ix1 < ix2 and iy1 < iy2:
                            inter = (ix2 - ix1) * (iy2 - iy1)
                            union = (fw * fh) + (sw * sh) - inter
                            iou = inter / max(1.0, union)
                            if iou > best_iou:
                                best_iou = iou
                                best_match = sb
                                
                    if best_match and best_iou > 0.35:
                        sx, sy, sw, sh = int(best_match["x"]), int(best_match["y"]), int(best_match["w"]), int(best_match["h"])
                        raw_c = str(best_match.get("modern_tamil", "")).strip()
                        clean_c = raw_c.split(',')[0].strip() if ',' in raw_c else raw_c
                        crop = image[sy:min(img_h, sy+sh), sx:min(img_w, sx+sw)]
                        if crop.size > 0:
                            merged_list.append({
                                "id": fr["id"], "x": sx, "y": sy, "w": sw, "h": sh,
                                "line": best_match.get("line", fr.get("line", 1)),
                                "saved_tamil": clean_c if clean_c and clean_c != "?" else None,
                                "crop": crop
                            })
                    else:
                        crop = image[fy:min(img_h, fy+fh), fx:min(img_w, fx+fw)]
                        if crop.size > 0:
                            fr["crop"] = crop
                            merged_list.append(fr)
                            
                regions = merged_list
            else:
                regions = []
                for fr in model_regions:
                    fx, fy, fw, fh = fr["x"], fr["y"], fr["w"], fr["h"]
                    crop = image[fy:min(img_h, fy+fh), fx:min(img_w, fx+fw)]
                    if crop.size > 0:
                        fr["crop"] = crop
                        regions.append(fr)
                        
            regions.sort(key=lambda r: (r.get("line", 1), r["x"]))
            for i, r in enumerate(regions):
                r["_id"] = i + 1
    except Exception:
        raise HTTPException(
            status_code=500,
            detail=f"Segmentation error:\n{traceback.format_exc()}"
        )

    if len(regions) == 0:
        h, w = image.shape[:2]
        regions = [{"id": 1, "x": 0, "y": 0, "w": w, "h": h, "line": 1, "crop": image}]

    if len(regions) < 1:
        raise HTTPException(
            status_code=400,
            detail="No word regions detected in the image. "
                   "Try a higher-contrast image or adjust segmentation parameters."
        )

    # ── 3. Classify all crops in one batch ──────────────────────────────
    try:
        crops   = [r["crop"] for r in regions]
        results = classifier.classify_batch(crops)
        
        # Inject memory overrides using Cosine Similarity (Few-Shot KNN)
        for i, r in enumerate(regions):
            features = results[i].get("features", [])
            _last_features[r["id"]] = features
            
            best_mem_char = None
            best_sim = 0.0
            matching_chars = []
            
            if features:
                # Scan from newest to oldest to prioritize recent user corrections
                for mem in reversed(correction_memory):
                    sim = cosine_similarity(features, mem["vector"])
                    if sim >= 0.86:
                        c_val = mem["modern_tamil"]
                        if c_val == "__IGNORE__":
                            results[i]["is_ignored"] = True
                            break
                        if c_val not in matching_chars:
                            matching_chars.append(c_val)
                        if sim > best_sim:
                            best_sim = sim
                            best_mem_char = c_val
            
            # If box loaded from user_boxes.json layout, preserve saved character choice
            if r.get("saved_tamil"):
                results[i]["memorized_options"] = [r["saved_tamil"]]
                results[i]["ai_original_tamil"] = results[i]["modern_tamil"]
                results[i]["modern_tamil"] = r["saved_tamil"]
                results[i]["is_memorized"] = True
            # If the structure matches past vector corrections, apply the best memorized character
            elif best_mem_char and not results[i].get("is_ignored"):
                results[i]["memorized_options"] = matching_chars
                results[i]["ai_original_tamil"] = results[i]["modern_tamil"] # Save the AI's original guess
                results[i]["modern_tamil"] = best_mem_char # Default to best memorized match
        # Filter out user-ignored memory boxes and extreme noise (confidence >= 0.02)
        valid_indices = [
            i for i in range(len(regions))
            if not results[i].get("is_ignored") and (results[i].get("is_memorized") or results[i]["confidence"] >= 0.02)
        ]
        if valid_indices:
            regions = [regions[i] for i in valid_indices]
            results = [results[i] for i in valid_indices]
    except Exception:
        raise HTTPException(
            status_code=500,
            detail=f"Classification error:\n{traceback.format_exc()}"
        )

    # ── 3.5. NLP Contextual Disambiguation ───────────────────────────────
    # Group results by line
    lines = {}
    for i, r in enumerate(regions):
        l = r["line"]
        if l not in lines:
            lines[l] = []
        lines[l].append(i)

    # Sanitize initial modern_tamil results while preserving full raw_chars for UI popover alternatives
    for r in results:
        if "modern_tamil" in r:
            raw_c = str(r.get("raw_chars", r["modern_tamil"]))
            r["raw_chars"] = raw_c
            if "," in raw_c and not r.get("is_memorized"):
                r["modern_tamil"] = raw_c.split(",")[0].strip()

    # Dotted <-> Base Consonant Mappings for Contextual Phonetic Expansion
    PULLI_MAP = {'க': 'க்', 'ங': 'ங்', 'ச': 'ச்', 'ஞ': 'ஞ்', 'ட': 'ட்', 'ண': 'ண்', 'த': 'த்', 'ந': 'ந்', 'ப': 'ப்', 'ம': 'ம்', 'ய': 'ய்', 'ர': 'ர்', 'ல': 'ல்', 'வ': 'வ்', 'ழ': 'ழ்', 'ள': 'ள்', 'ற': 'ற்', 'ன': 'ன்'}
    UNPULLI_MAP = {v: k for k, v in PULLI_MAP.items()}

    # Run Beam Search for each line
    all_alt_paths = []
    for l, indices in lines.items():
        sequence_options = []
        for i in indices:
            top3 = results[i].get("top3", [])
            raw_cls = results[i].get("raw_chars", results[i]["modern_tamil"])
            top1_variations = [c.strip() for c in raw_cls.replace(' ', '').split(',') if c.strip()]
            
            if results[i].get("is_memorized"):
                mem_chars = results[i].get("memorized_options", [results[i]["modern_tamil"]])
                ui_chars = list(dict.fromkeys(mem_chars + top1_variations))
                nlp_candidates = [(c, 0.95) for c in mem_chars]
            else:
                ui_chars = top1_variations
                nlp_candidates = []
                for t in top3:
                    conf = float(t.get("confidence", 0.5))
                    t_chars = [c.strip() for c in str(t.get("raw_options", t.get("modern_tamil", ""))).split(',') if c.strip()]
                    for c in t_chars:
                        if c not in [p[0] for p in nlp_candidates]:
                            nlp_candidates.append((c, conf))

            # Expand with base <-> pulli counterparts
            expanded_tuples = []
            seen_c = set()
            for c, conf in nlp_candidates:
                if c not in seen_c:
                    seen_c.add(c)
                    expanded_tuples.append((c, conf))
                if c in UNPULLI_MAP and UNPULLI_MAP[c] not in seen_c:
                    seen_c.add(UNPULLI_MAP[c])
                    expanded_tuples.append((UNPULLI_MAP[c], conf))
                if c in PULLI_MAP and PULLI_MAP[c] not in seen_c:
                    seen_c.add(PULLI_MAP[c])
                    expanded_tuples.append((PULLI_MAP[c], conf))

            sequence_options.append(expanded_tuples)
            results[i]["ambiguous_options"] = list(dict.fromkeys(ui_chars + [t[0] for t in expanded_tuples]))
            
        # Beam search decoding for top 10 mathematical sentence combinations
        top_k_paths = nlp_engine.beam_search_decode(sequence_options, top_k=10)
        
        best_path = top_k_paths[0] if top_k_paths else []
        for seq_idx, i in enumerate(indices):
            # Only allow NLP Beam Search to override modern_tamil if classifier confidence is low (< 50%)
            # and the box is NOT user-memorized or high-confidence (preserves true predictions like 'ன்' 90%)
            if results[i].get("confidence", 0.0) < 0.50 and not results[i].get("is_memorized"):
                if best_path and seq_idx < len(best_path):
                    results[i]["modern_tamil"] = best_path[seq_idx]
            else:
                raw_c = str(results[i]["modern_tamil"])
                results[i]["modern_tamil"] = raw_c.split(',')[0].strip()
                
        # Store clean alternative paths (filter out duplicate paths)
        for alt_path in top_k_paths[1:]:
            all_alt_paths.append((indices, alt_path))

    # ── 4. Build response ────────────────────────────────────────────────
    # Guarantee zero raw commas bleed into modern_tamil results for ALL boxes
    for r in results:
        raw_val = str(r.get("modern_tamil", "")).strip()
        if "," in raw_val:
            r["modern_tamil"] = raw_val.split(",")[0].strip()

    words: List[WordResult] = []
    for region, cls_result in zip(regions, results):
        tamil_char   = cls_result["modern_tamil"]
        is_unknown   = (tamil_char == _UNKNOWN_CLASS)
        display_char = "?" if is_unknown else tamil_char
        raw_top3     = cls_result.get("top3", [])
        top3_items   = [
            Top3Item(
                modern_tamil = ("?" if t["modern_tamil"] == _UNKNOWN_CLASS else t["modern_tamil"]),
                confidence   = t["confidence"],
            )
            for t in raw_top3
        ]
        words.append(WordResult(
            id           = region["id"],
            x            = region["x"],
            y            = region["y"],
            w            = region["w"],
            h            = region["h"],
            class_id     = cls_result["class_id"],
            modern_tamil = display_char,
            confidence   = cls_result["confidence"],
            line         = region["line"],
            is_unknown   = is_unknown,
            ambiguous_options = cls_result.get("ambiguous_options", []),
            is_memorized = cls_result.get("is_memorized", False)
        ))

    raw_sentence   = _build_sentence(words)
    sentence       = raw_sentence
    roman_sentence = _to_roman(sentence)
    line_count     = max((w.line for w in words), default=0)
    ai_refined_sentence = None
    ai_meaning          = None

    # Build alternative sentences (guaranteed zero raw commas)
    alternative_sentences = []
    alternative_roman_sentences = []
    for indices, alt_path in all_alt_paths:
        alt_words = []
        for w in words:
            clean_word = WordResult(**w.dict())
            if "," in clean_word.modern_tamil:
                clean_word.modern_tamil = clean_word.modern_tamil.split(",")[0].strip()
            alt_words.append(clean_word)
            
        for seq_idx, i in enumerate(indices):
            if seq_idx < len(alt_path):
                raw_c = str(alt_path[seq_idx]).strip()
                clean_c = raw_c.split(",")[0].strip() if "," in raw_c else raw_c
                alt_words[i].modern_tamil = clean_c
                
        alt_sentence = _build_sentence(alt_words)
        if "," in alt_sentence:
            alt_sentence = alt_sentence.replace(",", "").strip()
            
        if alt_sentence != sentence and alt_sentence not in alternative_sentences:
            alternative_sentences.append(alt_sentence)
            alternative_roman_sentences.append(_to_roman(alt_sentence))
            
    # Fast Initial Output: Leave AI Refinement for on-demand button click
    ai_refined_sentence = None
    ai_meaning = None
    ai_breakdown = None
            
    return TranslateResponse(
        words          = words,
        full_sentence  = sentence,
        roman_sentence = roman_sentence,
        raw_sentence   = raw_sentence,
        ai_refined_sentence = ai_refined_sentence,
        ai_meaning     = ai_meaning,
        ai_word_breakdown = ai_breakdown,
        alternative_sentences = alternative_sentences,
        alternative_roman_sentences = alternative_roman_sentences,
        word_count     = len(words),
        line_count     = line_count,
        image_width    = img_w,
        image_height   = img_h,
        img_hash       = img_hash,
    )


class RefineRequest(BaseModel):
    raw_characters: List[str]
    alternative_sentences: Optional[List[str]] = []
    line_groups: Optional[List[Dict]] = []


class RefineResponse(BaseModel):
    ai_refined_sentence: str
    modern_tamil_sentence: Optional[str] = ""
    english_translation: Optional[str] = ""
    ai_meaning: Optional[str] = None
    english_meaning: Optional[str] = None
    ai_word_breakdown: Optional[List[Dict]] = None
    line_breakdown: Optional[List[Dict]] = []
    alternative_sentences: List[str] = []
    roman_sentence: str = ""


@app.post("/refine-ai", response_model=RefineResponse)
async def refine_ai_endpoint(req: RefineRequest):
    """
    On-demand endpoint triggered when the user clicks '✨ Refine & Analyze with AI'.
    Analyzes raw characters and line groups to produce structured per-line epigraphic translations.
    """
    res = gemini_epigraphic_refine(req.raw_characters, req.alternative_sentences, req.line_groups)
    if not res or "full_sentence" not in res:
        raise HTTPException(status_code=500, detail="AI Refinement unavailable or failed.")
        
    refined_sentence = res["full_sentence"]
    modern_sentence = res.get("modern_tamil_sentence", refined_sentence)
    eng_trans = res.get("english_translation", "")
    meaning = res.get("meaning", "")
    eng_meaning = res.get("english_meaning", "")
    breakdown = res.get("word_breakdown", [])
    line_breakdown = res.get("line_breakdown", [])
    alts = res.get("alternative_readings", [])[:10]
    roman = _to_roman(refined_sentence)
    
    return RefineResponse(
        ai_refined_sentence=refined_sentence,
        modern_tamil_sentence=modern_sentence,
        english_translation=eng_trans,
        ai_meaning=meaning,
        english_meaning=eng_meaning,
        ai_word_breakdown=breakdown,
        line_breakdown=line_breakdown,
        alternative_sentences=alts,
        roman_sentence=roman
    )


class RememberRequest(BaseModel):
    word_id: int
    modern_tamil: str

@app.post("/api/remember")
def remember_correction(req: RememberRequest):
    if req.word_id in _last_features:
        new_vec = _last_features[req.word_id]
        global correction_memory
        # Remove any existing close vector matches (>0.88 similarity) so the new correction replaces old choices
        correction_memory = [
            mem for mem in correction_memory
            if cosine_similarity(new_vec, mem["vector"]) <= 0.88
        ]
        correction_memory.append({
            "vector": new_vec,
            "modern_tamil": req.modern_tamil
        })
        save_memory()
        return {"status": "ok"}
    return {"status": "not_found"}


@app.post("/api/classify-crop")
async def classify_crop(
    file: UploadFile = File(...),
    x: int = Form(...),
    y: int = Form(...),
    w: int = Form(...),
    h: int = Form(...),
    filename: Optional[str] = Form(None)
):
    """
    Classifies a manually drawn bounding box crop and saves it to user_boxes.json.
    """
    raw = await file.read()
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    ih, iw = image.shape[:2]
    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(iw, x + w)
    y2 = min(ih, y + h)

    if x2 <= x1 or y2 <= y1:
        crop = image
    else:
        crop = image[y1:y2, x1:x2]

    results = classifier.classify_batch([crop])
    res = results[0]

    # Automatically save newly drawn box shape & feature vector into memory!
    features = res.get("features", [])
    if features:
        global correction_memory
        correction_memory.append({
            "vector": features,
            "modern_tamil": res["modern_tamil"]
        })
        save_memory()

    return {
        "modern_tamil": res["modern_tamil"],
        "confidence": float(res["confidence"]),
        "top3": res.get("top3", [])
    }


class SaveSegmentationRequest(BaseModel):
    filename: str
    boxes: List[Dict]
    img_hash: Optional[str] = None

@app.post("/api/save-final-segmentation")
async def save_final_segmentation(req: SaveSegmentationRequest):
    """
    Saves the final user-edited segmentation layout for an image filename to user_boxes.json.
    """
    global user_boxes_db
    raw_fn = req.filename or "custom_image.jpg"
    fname = urllib.parse.unquote(os.path.basename(raw_fn)).strip()
    
    clean_boxes = []
    for b in req.boxes:
        clean_boxes.append({
            "x": int(b.get("x", 0)),
            "y": int(b.get("y", 0)),
            "w": int(b.get("w", 10)),
            "h": int(b.get("h", 10)),
            "modern_tamil": str(b.get("modern_tamil", ""))
        })
        
    # Remove any existing normalized duplicates before updating
    target_norm = normalize_fname(fname)
    for k in list(user_boxes_db.keys()):
        if normalize_fname(k) == target_norm:
            del user_boxes_db[k]

    user_boxes_db[fname] = clean_boxes
    if req.img_hash:
        user_boxes_db[req.img_hash] = clean_boxes
        print(f"[SAVE] Indexed {len(clean_boxes)} custom boxes under MD5 hash {req.img_hash[:8]}...")

    save_user_boxes()

    # Automatically extract and save feature vectors into global vector memory for cross-image learning
    global correction_memory
    saved_vec_count = 0
    for b in req.boxes:
        c_val = str(b.get("modern_tamil", "")).strip()
        if c_val and c_val != "?":
            box_id = b.get("id")
            if box_id and box_id in _last_features:
                vec = _last_features[box_id]
                correction_memory = [
                    mem for mem in correction_memory
                    if cosine_similarity(vec, mem["vector"]) <= 0.88
                ]
                correction_memory.append({
                    "vector": vec,
                    "modern_tamil": c_val
                })
                saved_vec_count += 1
    save_memory()

    print(f"[SAVE] Saved {len(clean_boxes)} custom boxes for {fname} + {saved_vec_count} universal character vectors")
    return {"status": "ok", "saved_count": len(clean_boxes), "filename": fname, "saved_vectors": saved_vec_count}


class ForgetRequest(BaseModel):
    word_id: int

@app.post("/api/forget-memory")
def forget_memory(req: ForgetRequest):
    if req.word_id in _last_features:
        target_vec = _last_features[req.word_id]
        global correction_memory
        initial_len = len(correction_memory)
        correction_memory = [
            mem for mem in correction_memory
            if cosine_similarity(target_vec, mem["vector"]) <= 0.85
        ]
        save_memory()
        return {"status": "ok", "removed": initial_len - len(correction_memory)}
    return {"status": "not_found"}


@app.get("/api/memory-summary")
def get_memory_summary():
    """
    Returns full summary of saved character vector memories and layout memories for Memory Studio.
    """
    vec_summary = []
    for idx, mem in enumerate(correction_memory):
        vec_summary.append({
            "index": idx,
            "modern_tamil": mem.get("modern_tamil", "?"),
            "vector_len": len(mem.get("vector", []))
        })
        
    return {
        "vector_memory_count": len(correction_memory),
        "vector_memories": vec_summary,
        "layout_memory_count": len(user_boxes_db),
        "layout_memories": user_boxes_db
    }

@app.delete("/api/delete-vector-memory/{index}")
def delete_vector_memory(index: int):
    global correction_memory
    if 0 <= index < len(correction_memory):
        removed = correction_memory.pop(index)
        save_memory()
        return {"status": "ok", "removed": removed.get("modern_tamil")}
    raise HTTPException(status_code=400, detail="Invalid index")

class DeleteLayoutRequest(BaseModel):
    filename: str

@app.post("/api/delete-layout-memory")
def delete_layout_memory(req: DeleteLayoutRequest):
    global user_boxes_db
    fname = os.path.basename(req.filename)
    if fname in user_boxes_db:
        del user_boxes_db[fname]
        save_user_boxes()
        return {"status": "ok", "deleted": fname}
    # Check fallback key
    for k in list(user_boxes_db.keys()):
        if os.path.basename(k) == fname or fname in k:
            del user_boxes_db[k]
            save_user_boxes()
            return {"status": "ok", "deleted": k}
    return {"status": "not_found"}

@app.post("/api/clear-segmentation-memory")
@app.post("/api/clear-layout-memory")
def clear_layout_memory_all():
    global user_boxes_db
    count = len(user_boxes_db)
    user_boxes_db = {}
    save_user_boxes()
    return {"status": "ok", "message": f"Cleared {count} saved segmentation & layout memories"}

@app.post("/api/clear-vector-memory")
def clear_vector_memory_all():
    global correction_memory
    count = len(correction_memory)
    correction_memory = []
    save_memory()
    return {"status": "ok", "message": f"Cleared {count} character vector memories"}

@app.post("/api/clear-all-memory")
def clear_all_memory():
    global correction_memory, user_boxes_db
    v_count = len(correction_memory)
    l_count = len(user_boxes_db)
    correction_memory = []
    user_boxes_db = {}
    save_memory()
    save_user_boxes()
    return {"status": "ok", "message": f"Cleared {v_count} vector memories and {l_count} layout memories"}


@app.post("/segment-only", response_model=SegmentResponse)
async def segment_only(
    file: UploadFile = File(...),
    merge_gap: int = Form(4)
):
    """
    Segmentation only — returns bounding boxes without classification.
    Useful for tuning segmentation parameters independently.
    """
    raw   = await file.read()
    image = _decode_image(raw)
    img_h, img_w = image.shape[:2]

    try:
        regions = segment_words(image, merge_gap_x=merge_gap)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail=f"Segmentation error:\n{traceback.format_exc()}"
        )

    if len(regions) == 0:
        h, w = image.shape[:2]
        regions = [{"id": 1, "x": 0, "y": 0, "w": w, "h": h, "line": 1, "crop": image}]

    if len(regions) < 1:
        raise HTTPException(
            status_code=400,
            detail="No word regions detected in the image."
        )

    boxes = [
        BoundingBox(
            id   = r["id"],
            x    = r["x"],
            y    = r["y"],
            w    = r["w"],
            h    = r["h"],
            line = r["line"],
        )
        for r in regions
    ]

    line_count = max((b.line for b in boxes), default=0)

    return SegmentResponse(
        boxes        = boxes,
        word_count   = len(boxes),
        line_count   = line_count,
        image_width  = img_w,
        image_height = img_h,
    )


# ─────────────────────────────────────────────
#  DATASET STUDIO ENDPOINTS
# ─────────────────────────────────────────────
import uuid
import base64
from pathlib import Path

# Resolve CLEANED DATA SET relative to this backend file
_DATASET_ROOT = Path(__file__).resolve().parent.parent / "CLEANED DATA SET"


class DatasetCropItem(BaseModel):
    corrected: str
    x:         int
    y:         int
    w:         int
    h:         int


@app.post("/api/dataset/add-crops")
async def dataset_add_crops(
    file:        UploadFile = File(...),
    corrections: str        = Form(...),   # JSON-encoded list of DatasetCropItem
):
    """
    Crop corrected characters from the uploaded image and save them
    into the CLEANED DATA SET training folders.
    """
    try:
        items = json.loads(corrections)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid corrections JSON.")

    raw   = await file.read()
    image = _decode_image(raw)
    img_h, img_w = image.shape[:2]

    _DATASET_ROOT.mkdir(parents=True, exist_ok=True)

    saved          = 0
    skipped        = 0
    classes_updated: list[str] = []

    for item in items:
        char = item.get("corrected", "").strip()
        if not char:
            skipped += 1
            continue

        x = float(item.get("x", 0))
        y = float(item.get("y", 0))
        w = float(item.get("w", 0))
        h = float(item.get("h", 0))
        orig_w = float(item.get("orig_w", 0))
        orig_h = float(item.get("orig_h", 0))

        if w <= 0 or h <= 0:
            skipped += 1
            continue

        # Scale coordinates if segmentation image resolution differed from uploaded image resolution
        if orig_w > 0 and orig_h > 0 and (abs(orig_w - img_w) > 2 or abs(orig_h - img_h) > 2):
            scale_x = img_w / orig_w
            scale_y = img_h / orig_h
            x = x * scale_x
            y = y * scale_y
            w = w * scale_x
            h = h * scale_y

        ix, iy, iw, ih = int(x), int(y), int(w), int(h)

        # 5% padding so the character isn't perfectly touching the crop edge
        px = max(0, int(iw * 0.05))
        py = max(0, int(ih * 0.05))
        y1 = max(0, iy - py);  y2 = min(img_h, iy + ih + py)
        x1 = max(0, ix - px);  x2 = min(img_w, ix + iw + px)

        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            skipped += 1
            continue

        # Find or create the matching class folder
        target_folder: Optional[Path] = None
        for folder in _DATASET_ROOT.iterdir():
            if not folder.is_dir():
                continue
            folder_chars = [c.strip() for c in folder.name.replace(" ", "").split(",")]
            if char in folder_chars:
                target_folder = folder
                break

        if target_folder is None:
            target_folder = _DATASET_ROOT / char
            target_folder.mkdir(parents=True, exist_ok=True)

        out_path = target_folder / f"correction_{uuid.uuid4().hex[:8]}.jpg"
        ok, buf  = cv2.imencode(".jpg", crop)
        if ok:
            out_path.write_bytes(buf.tobytes())
            saved += 1
            if char not in classes_updated:
                classes_updated.append(char)
        else:
            skipped += 1

    return {"saved": saved, "skipped": skipped, "classes_updated": classes_updated}


@app.get("/api/dataset/stats")
async def dataset_stats():
    """
    Return per-class image counts and up to 4 small preview thumbnails (base64).
    """
    if not _DATASET_ROOT.exists():
        return {"classes": []}

    result = []
    THUMB = 64   # thumbnail size px

    for folder in sorted(_DATASET_ROOT.iterdir()):
        if not folder.is_dir():
            continue

        images = sorted(
            list(folder.glob("*.jpg")) +
            list(folder.glob("*.png")) +
            list(folder.glob("*.jpeg"))
        )

        previews: list[str] = []
        for img_path in images[:4]:
            try:
                data = img_path.read_bytes()
                arr  = np.frombuffer(data, np.uint8)
                img  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img is None:
                    continue
                h, w  = img.shape[:2]
                scale = THUMB / max(h, w)
                nh, nw = max(1, int(h * scale)), max(1, int(w * scale))
                thumb = cv2.resize(img, (nw, nh))
                _, tbuf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 70])
                previews.append(base64.b64encode(tbuf).decode())
            except Exception:
                pass

        result.append({
            "class_name": folder.name,
            "count":      len(images),
            "previews":   previews,
        })

    return {"classes": result}


@app.get("/api/dataset/class-images/{class_name}")
async def dataset_class_images(class_name: str):
    """
    Return ALL images in a class folder as base64 thumbnails with filenames.
    Used by the Dataset Studio detail modal to show every crop.
    """
    safe_class = Path(class_name).name
    folder = _DATASET_ROOT / safe_class

    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail=f"Class '{safe_class}' not found.")

    images = sorted(
        list(folder.glob("*.jpg")) +
        list(folder.glob("*.png")) +
        list(folder.glob("*.jpeg"))
    )

    THUMB = 96   # slightly larger thumbnail for the detail view
    result = []

    for idx, img_path in enumerate(images):
        try:
            data = img_path.read_bytes()
            arr  = np.frombuffer(data, np.uint8)
            img  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                continue
            h, w  = img.shape[:2]
            scale = THUMB / max(h, w)
            nh, nw = max(1, int(h * scale)), max(1, int(w * scale))
            thumb = cv2.resize(img, (nw, nh))
            _, tbuf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
            result.append({
                "index":    idx,
                "filename": img_path.name,
                "b64":      base64.b64encode(tbuf).decode(),
            })
        except Exception:
            pass

    return {"class_name": safe_class, "total": len(images), "images": result}


class DeleteCropRequest(BaseModel):
    class_name: str
    filename:   str


@app.delete("/api/dataset/crop")
async def dataset_delete_crop(req: DeleteCropRequest):
    """Delete a single crop image from the dataset folder."""
    safe_class = Path(req.class_name).name
    safe_file  = Path(req.filename).name
    target = _DATASET_ROOT / safe_class / safe_file
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Not a file.")
    target.unlink()
    return {"status": "deleted", "file": safe_file}


class DeleteByIndexRequest(BaseModel):
    class_name: str
    index:      int


@app.delete("/api/dataset/crop-by-index")
async def dataset_delete_crop_by_index(req: DeleteByIndexRequest):
    """Delete the Nth image (sorted alphabetically) in a class folder."""
    safe_class = Path(req.class_name).name
    folder = _DATASET_ROOT / safe_class
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail="Class folder not found.")

    images = sorted(
        list(folder.glob("*.jpg")) +
        list(folder.glob("*.png")) +
        list(folder.glob("*.jpeg"))
    )

    if req.index < 0 or req.index >= len(images):
        raise HTTPException(status_code=404, detail=f"Index {req.index} out of range (folder has {len(images)} images).")

    target = images[req.index]
    target.unlink()
    return {"status": "deleted", "file": target.name}


# ─────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
