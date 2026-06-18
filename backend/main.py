"""
Ancient Tamil Inscription Translator — FastAPI Backend
Endpoints:
    GET  /health        — liveness check
    POST /translate     — full segmentation + classification pipeline
    POST /segment-only  — segmentation only (no classification)
"""

import io
import traceback
from typing import List

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from segmentation import segment_words
import classifier

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
    allow_credentials=True,
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


class TranslateResponse(BaseModel):
    words:        List[WordResult]
    full_sentence: str
    word_count:   int
    line_count:   int
    image_width:  int
    image_height: int


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
async def translate(file: UploadFile = File(...)):
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
        regions = segment_words(image)
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

    # ── 4. Build response ────────────────────────────────────────────────
    words: List[WordResult] = []
    for region, cls_result in zip(regions, results):
        words.append(WordResult(
            id           = region["id"],
            x            = region["x"],
            y            = region["y"],
            w            = region["w"],
            h            = region["h"],
            class_id     = cls_result["class_id"],
            modern_tamil = cls_result["modern_tamil"],
            confidence   = cls_result["confidence"],
            line         = region["line"],
        ))

    sentence   = _build_sentence(words)
    line_count = max((w.line for w in words), default=0)

    return TranslateResponse(
        words         = words,
        full_sentence  = sentence,
        word_count    = len(words),
        line_count    = line_count,
        image_width   = img_w,
        image_height  = img_h,
    )


@app.post("/segment-only", response_model=SegmentResponse)
async def segment_only(file: UploadFile = File(...)):
    """
    Segmentation only — returns bounding boxes without classification.
    Useful for tuning segmentation parameters independently.
    """
    raw   = await file.read()
    image = _decode_image(raw)
    img_h, img_w = image.shape[:2]

    try:
        regions = segment_words(image)
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
