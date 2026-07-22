"""
Ancient Tamil Inscription Translator — FastAPI Backend
Endpoints:
    GET  /health        — liveness check
    POST /translate     — full segmentation + classification pipeline
    POST /segment-only  — segmentation only (no classification)
"""

import io
import traceback
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
    top3:         List[Top3Item] = []
    ambiguous_options: List[str] = []


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
    merge_gap: int = Form(4)
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
    try:
        regions = segment_words(image, mode=mode, merge_gap_x=merge_gap)
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

    # Run Beam Search for each line
    all_alt_paths = []
    for l, indices in lines.items():
        sequence_options = []
        for i in indices:
            cid = results[i]["modern_tamil"]
            # e.g., "மு, ழு, மூ, ழூ" -> ["மு", "ழு", "மூ", "ழூ"]
            chars = [c.strip() for c in cid.replace(' ', '').split(',')]
            sequence_options.append(chars)
            results[i]["ambiguous_options"] = chars
            
        # We ask for the top 5 most mathematically probable full-sentence interpretations.
        top_k_paths = nlp_engine.beam_search_decode(sequence_options, top_k=5)
        
        best_path = top_k_paths[0] if top_k_paths else []
        for seq_idx, i in enumerate(indices):
            if best_path and seq_idx < len(best_path):
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
            top3         = top3_items,
            ambiguous_options = cls_result.get("ambiguous_options", [])
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
#  ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
