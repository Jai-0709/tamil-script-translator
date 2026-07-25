"""
Ancient Tamil Inscription Translator — FastAPI Backend
Endpoints:
    GET  /health        — liveness check
    POST /translate     — full segmentation + classification pipeline
    POST /segment-only  — segmentation only (no classification)
"""

import io
import traceback
import hashlib
import json
import os
from typing import List, Optional

import cv2
import uvicorn
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from segmentation import segment_words
import classifier
from nlp_engine import nlp_engine

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
    print("[INFO] Aksharamukha loaded — Roman transliteration enabled.")
except ImportError:
    def _to_roman(text: str) -> str:
        return text
    _AKSHA_AVAILABLE = False
    print("[WARN] aksharamukha not installed — Roman transliteration disabled.")

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
    with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(correction_memory, f, ensure_ascii=False)

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
        with open(USER_BOXES_PATH, "w", encoding="utf-8") as f:
            json.dump(user_boxes_db, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving user boxes: {e}")

load_user_boxes()

def get_user_boxes_for_file(filename: str):
    if not filename:
        return []
    base = os.path.basename(filename)
    if base in user_boxes_db:
        return user_boxes_db[base]
    if filename in user_boxes_db:
        return user_boxes_db[filename]
    for k in user_boxes_db:
        if k in filename or filename in k or os.path.basename(k) == base:
            return user_boxes_db[k]
    return []

def cosine_similarity(v1, v2):
    v1 = np.array(v1)
    v2 = np.array(v2)
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9))


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
    alternative_sentences: List[str] = []
    alternative_roman_sentences: List[str] = []
    word_count:     int
    line_count:     int
    image_width:    int
    image_height:   int


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
    custom_boxes_json: str = Form(None)
):
    """
    Full pipeline: segment inscription → classify each region.

    Accepts any image format supported by OpenCV (JPEG, PNG, BMP, TIFF, WEBP).
    """
    # ── 1. Read & decode image ──────────────────────────────────────────
    raw   = await file.read()
    image = _decode_image(raw)
    img_h, img_w = image.shape[:2]

    # ── 2. Segment ──────────────────────────────────────────────────────
    import json
    try:
        if custom_boxes_json:
            custom_boxes = json.loads(custom_boxes_json)
            regions = []
            for i, box in enumerate(custom_boxes):
                x, y, w, h = int(box["x"]), int(box["y"]), int(box["w"]), int(box["h"])
                crop = image[y:y+h, x:x+w]
                regions.append({
                    "x": x, "y": y, "w": w, "h": h, 
                    "line": box.get("line", 1), 
                    "id": i + 1, 
                    "crop": crop
                })
        else:
            regions = segment_words(image, mode=mode, merge_gap_x=merge_gap)

        # Load persistent user-saved custom segmentation layout for this image if available
        fname = getattr(file, "filename", None)
        saved_boxes = get_user_boxes_for_file(fname)
        if saved_boxes:
            print(f"[TRANSLATE] Loaded {len(saved_boxes)} user-saved custom segmentation layout for {fname}")
            regions = []
            for i, sb in enumerate(saved_boxes):
                sx = max(0, int(sb["x"]))
                sy = max(0, int(sb["y"]))
                sw = int(sb["w"])
                sh = int(sb["h"])
                crop = image[sy:min(img_h, sy+sh), sx:min(img_w, sx+sw)]
                if crop.size > 0:
                    regions.append({
                        "id": i + 1,
                        "_id": i + 1,
                        "x": sx, "y": sy, "w": sw, "h": sh,
                        "line": 1,
                        "crop": crop
                    })
            regions.sort(key=lambda r: (r["line"], r["x"]))
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
                    if sim > 0.90:
                        c_val = mem["modern_tamil"]
                        if c_val == "__IGNORE__":
                            results[i]["is_ignored"] = True
                            break
                        if c_val not in matching_chars:
                            matching_chars.append(c_val)
                        if sim > best_sim:
                            best_sim = sim
                            best_mem_char = c_val
            
            # If the structure matches past corrections, apply the best memorized character
            if best_mem_char and not results[i].get("is_ignored"):
                results[i]["memorized_options"] = matching_chars
                results[i]["ai_original_tamil"] = results[i]["modern_tamil"] # Save the AI's original guess
                results[i]["modern_tamil"] = best_mem_char # Default to best memorized match
                results[i]["is_memorized"] = True
            else:
                results[i]["is_memorized"] = False

        # Filter out low-confidence noise boxes and user-ignored memory boxes
        valid_indices = [
            i for i in range(len(regions))
            if not results[i].get("is_ignored") and (results[i].get("is_memorized") or results[i]["confidence"] >= 0.25)
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

    # Dotted <-> Base Consonant Mappings for Contextual Phonetic Expansion
    PULLI_MAP = {'க': 'க்', 'ங': 'ங்', 'ச': 'ச்', 'ஞ': 'ஞ்', 'ட': 'ட்', 'ண': 'ண்', 'த': 'த்', 'ந': 'ந்', 'ப': 'ப்', 'ம': 'ம்', 'ய': 'ய்', 'ர': 'ர்', 'ல': 'ல்', 'வ': 'வ்', 'ழ': 'ழ்', 'ள': 'ள்', 'ற': 'ற்', 'ன': 'ன்'}
    UNPULLI_MAP = {v: k for k, v in PULLI_MAP.items()}

    # Run Beam Search for each line
    all_alt_paths = []
    for l, indices in lines.items():
        sequence_options = []
        for i in indices:
            if results[i].get("is_memorized"):
                cid = results[i].get("ai_original_tamil", results[i]["modern_tamil"])
                ai_chars = [c.strip() for c in cid.replace(' ', '').split(',')]
                mem_chars = results[i].get("memorized_options", [results[i]["modern_tamil"]])
                ui_chars = mem_chars + [c for c in ai_chars if c not in mem_chars]
                nlp_chars = list(mem_chars)
            else:
                cid = results[i]["modern_tamil"]
                chars = [c.strip() for c in cid.replace(' ', '').split(',')]
                ui_chars = chars
                nlp_chars = list(chars)
            
            # Automatically expand nlp_chars to include base <-> pulli counterparts
            # so Beam Search can evaluate word context (e.g. tiruppattam -> #3 is ப், #4 is ப)!
            expanded = []
            for c in nlp_chars:
                if c not in expanded: expanded.append(c)
                if c in UNPULLI_MAP and UNPULLI_MAP[c] not in expanded:
                    expanded.append(UNPULLI_MAP[c])
                if c in PULLI_MAP and PULLI_MAP[c] not in expanded:
                    expanded.append(PULLI_MAP[c])
                    
            sequence_options.append(expanded)
            results[i]["ambiguous_options"] = list(dict.fromkeys(ui_chars + expanded))
            
        # We ask for the top 8 most mathematically probable full-sentence interpretations.
        top_k_paths = nlp_engine.beam_search_decode(sequence_options, top_k=8)
        
        best_path = top_k_paths[0] if top_k_paths else []
        for seq_idx, i in enumerate(indices):
            if best_path and seq_idx < len(best_path):
                # Update with the best mathematical Beam Search contextual character
                results[i]["modern_tamil"] = best_path[seq_idx]
                
        # Store alternative paths for later
        for alt_path in top_k_paths[1:]:
            all_alt_paths.append((indices, alt_path))

    # ── 4. Build response ────────────────────────────────────────────────
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

    sentence      = _build_sentence(words)
    roman_sentence = _to_roman(sentence)
    line_count    = max((w.line for w in words), default=0)

    # Build alternative sentences
    alternative_sentences = []
    alternative_roman_sentences = []
    for indices, alt_path in all_alt_paths:
        alt_words = []
        for w in words:
            alt_words.append(WordResult(**w.dict()))
            
        for seq_idx, i in enumerate(indices):
            if seq_idx < len(alt_path):
                alt_words[i].modern_tamil = alt_path[seq_idx]
                
        alt_sentence = _build_sentence(alt_words)
        if alt_sentence != sentence and alt_sentence not in alternative_sentences:
            alternative_sentences.append(alt_sentence)
            alternative_roman_sentences.append(_to_roman(alt_sentence))
            
    return TranslateResponse(
        words          = words,
        full_sentence  = sentence,
        roman_sentence = roman_sentence,
        alternative_sentences = alternative_sentences,
        alternative_roman_sentences = alternative_roman_sentences,
        word_count     = len(words),
        line_count     = line_count,
        image_width    = img_w,
        image_height   = img_h,
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

    # Save user box to user_boxes.json for this image filename
    fname = filename or getattr(file, "filename", None)
    if fname:
        global user_boxes_db
        if fname not in user_boxes_db:
            user_boxes_db[fname] = []
        user_boxes_db[fname].append({
            "x": int(x), "y": int(y), "w": int(w), "h": int(h),
            "modern_tamil": res["modern_tamil"]
        })
        save_user_boxes()

    return {
        "modern_tamil": res["modern_tamil"],
        "confidence": float(res["confidence"]),
        "top3": res.get("top3", [])
    }


class SaveSegmentationRequest(BaseModel):
    filename: str
    boxes: List[Dict]

@app.post("/api/save-final-segmentation")
async def save_final_segmentation(req: SaveSegmentationRequest):
    """
    Saves the final user-edited segmentation layout for an image filename to user_boxes.json.
    """
    global user_boxes_db
    fname = os.path.basename(req.filename) if req.filename else "custom_image.jpg"
    
    clean_boxes = []
    for b in req.boxes:
        clean_boxes.append({
            "x": int(b.get("x", 0)),
            "y": int(b.get("y", 0)),
            "w": int(b.get("w", 10)),
            "h": int(b.get("h", 10)),
            "modern_tamil": str(b.get("modern_tamil", ""))
        })
        
    user_boxes_db[fname] = clean_boxes
    save_user_boxes()
    return {"status": "ok", "saved_count": len(clean_boxes), "filename": fname}


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


@app.post("/api/clear-all-memory")
def clear_all_memory():
    global correction_memory
    correction_memory = []
    save_memory()
    return {"status": "ok", "message": "All memory database entries cleared"}


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
