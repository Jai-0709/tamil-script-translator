"""
segmentation.py — Adaptive Character-level Region Extraction for Stone Inscriptions.

Robust Pipeline (works on any inscription size, lighting, noise level):
  1  Resize to max 1200px width (preserve aspect ratio)
  2  Convert to grayscale
  3  Detect image type: clean doc / dark doc / stone inscription
  4  Apply adaptive pre-processing based on type:
       - Stone inscriptions: bilateral filter + CLAHE + adaptive threshold
       - Clean documents: Otsu threshold directly
  5  Multi-scale morphological dilation to group character strokes
  6  Find contours with strict adaptive size filters
  7  Remove overlapping boxes (IoU-based)
  8  Line detection via y-center clustering (adaptive gap)
  9  Sort by line then x-position
  10 Map coordinates back to original resolution
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional

import cv2
import numpy as np

# ─────────────────────────────────────────────
#  Optional debug image saving
# ─────────────────────────────────────────────
_DEBUG_DIR: Optional[str] = os.environ.get("SEG_DEBUG_DIR", "")


def _save_debug_step(filename: str, img: np.ndarray) -> None:
    if not _DEBUG_DIR:
        return
    os.makedirs(_DEBUG_DIR, exist_ok=True)
    cv2.imwrite(os.path.join(_DEBUG_DIR, filename), img)


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────
def _resize_to_max(img: np.ndarray, max_width: int) -> np.ndarray:
    h, w = img.shape[:2]
    if w <= max_width:
        return img.copy()
    scale = max_width / w
    return cv2.resize(img, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)


def _detect_image_type(gray: np.ndarray) -> str:
    """
    Detect whether the image is a clean document, dark document,
    or a stone inscription.

    Strategy: sample a broad border strip (5% of image on each side),
    compute the MEDIAN brightness (robust to noise), and also check
    the interior contrast and texture variance to distinguish stone.
    """
    h, w = gray.shape

    # Sample 5% border strip on all 4 sides
    bw = max(10, w // 20)
    bh = max(10, h // 20)

    border_pixels = np.concatenate([
        gray[:bh, :].ravel(),           # top strip
        gray[-bh:, :].ravel(),          # bottom strip
        gray[:, :bw].ravel(),           # left strip
        gray[:, -bw:].ravel(),          # right strip
    ])

    bg_brightness = float(np.median(border_pixels))

    # Interior region (avoid border)
    interior = gray[bh:-bh, bw:-bw]
    interior_std  = float(interior.std())          # overall contrast
    interior_mean = float(interior.mean())

    # Texture roughness: compare local variance across small blocks
    # Stone has high LOCAL variance (grain/cracks) but medium GLOBAL mean
    # Clean docs have low local variance (white paper)
    # We approximate this via Laplacian variance (measures sharpness/texture)
    lap_var = float(cv2.Laplacian(interior, cv2.CV_64F).var())

    print(f"[SEG] bg_median={bg_brightness:.1f} interior_mean={interior_mean:.1f} "
          f"interior_std={interior_std:.1f} lap_var={lap_var:.1f}")

    if bg_brightness > 200 and interior_std > 20:
        # Very bright border = clean printed/written document on paper
        return "clean_document"
    elif bg_brightness < 60 and interior_mean > 150:
        # Dark outer frame but bright interior = photo of document page (WhatsApp etc.)
        # Treat as clean document — text is dark on white
        return "clean_document"
    elif bg_brightness < 60:
        return "dark_document"
    else:
        # Stone inscriptions: medium grey background, medium texture
        return "stone_inscription"


def _preprocess_stone(gray: np.ndarray, img_type: str) -> np.ndarray:
    """
    Returns a clean binary mask where characters are WHITE (foreground).
    Applies different pre-processing strategies per image type.
    """
    h, w = gray.shape

    if img_type == "clean_document":
        # Dark text on white/cream paper — invert Otsu to make text WHITE (foreground)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        # Morphological opening to remove pepper noise on clean docs
        k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k_open, iterations=1)
        return binary

    elif img_type == "dark_document":
        # Truly dark background with lighter text (e.g. chalk on blackboard)
        inverted = cv2.bitwise_not(gray)
        blurred = cv2.GaussianBlur(inverted, (5, 5), 0)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return binary

    else:
        # stone_inscription: full pipeline
        # Step A — Bilateral filter (removes grain noise while keeping sharp edges)
        bilateral = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)
        _save_debug_step("02a_bilateral.jpg", bilateral)

        # Step B — Strong Gaussian blur to kill stone grain texture
        blurred = cv2.GaussianBlur(bilateral, (21, 21), 0)
        _save_debug_step("02b_blurred.jpg", blurred)

        # Step C — CLAHE to enhance local contrast across stone variations
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(blurred)
        _save_debug_step("02c_clahe.jpg", enhanced)

        # Step D — Invert so dark carvings become bright foreground
        inverted = cv2.bitwise_not(enhanced)
        _save_debug_step("02d_inverted.jpg", inverted)

        # Step E — Fixed threshold at 127, auto-raise if too much foreground
        _, binary = cv2.threshold(inverted, 127, 255, cv2.THRESH_BINARY)
        fg_pct = cv2.countNonZero(binary) / binary.size
        print(f"[SEG] Foreground at thresh 127: {fg_pct:.1%}")

        if fg_pct > 0.45:
            _, binary = cv2.threshold(inverted, 150, 255, cv2.THRESH_BINARY)
            fg_pct = cv2.countNonZero(binary) / binary.size
            print(f"[SEG] Foreground at thresh 150: {fg_pct:.1%}")

        if fg_pct > 0.60:
            _, binary = cv2.threshold(inverted, 170, 255, cv2.THRESH_BINARY)
            fg_pct = cv2.countNonZero(binary) / binary.size
            print(f"[SEG] Foreground at thresh 170: {fg_pct:.1%}")

        _save_debug_step("02e_binary.jpg", binary)

        # Step F — Morphological opening to remove tiny speckles
        k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k_open, iterations=2)
        _save_debug_step("02f_cleaned.jpg", cleaned)

        return cleaned


def _compute_adaptive_params(img_w: int, img_h: int, img_type: str = "stone_inscription") -> dict:
    """
    Compute all morphological and filter parameters based on image size and type.
    Clean documents need a very small dilation kernel — otherwise adjacent
    printed characters merge into one huge blob.
    """
    estimated_char_w = max(15, img_w // 35)
    estimated_char_h = max(15, img_h // 12)

    if img_type == "clean_document":
        # Printed/written text: characters are already well-separated — use MINIMAL dilation
        # A large kernel merges the entire line into one blob
        k_w = 2
        k_h = 1
        min_w  = max(5,  img_w // 80)    # printed chars can be quite small
        min_h  = max(5,  img_h // 40)
        min_area = min_w * min_h
        max_w  = int(img_w * 0.15)       # single char never > 15% of width
        max_h  = int(img_h * 0.20)       # single char never > 20% of height
        border = max(5, int(min(img_w, img_h) * 0.01))
        line_gap = max(10, int(estimated_char_h * 0.4))
    else:
        # Stone inscriptions: strokes need connecting — use wider dilation
        k_w = min(6, max(3, int(estimated_char_w * 0.25)))
        k_h = min(2, max(2, int(estimated_char_h * 0.08)))

        if img_w < 300:
            min_w, min_h = 10, 10
            min_area = 100
        elif img_w < 600:
            min_w, min_h = 15, 15
            min_area = 300
        else:
            min_w, min_h = 22, 22
            min_area = 500

        max_w  = int(img_w * 0.25)
        max_h  = int(img_h * 0.40)
        border = max(20, int(min(img_w, img_h) * 0.025))
        line_gap = max(20, int(estimated_char_h * 0.5))

    return {
        "k_w": k_w, "k_h": k_h,
        "min_w": min_w, "min_h": min_h, "min_area": min_area,
        "max_w": max_w, "max_h": max_h,
        "border": border,
        "line_gap": line_gap,
    }


def _remove_overlaps(regions: List[Dict], overlap_thresh: float = 0.4) -> List[Dict]:
    """Remove smaller boxes that are largely covered by larger boxes."""
    keep: List[Dict] = []
    regions_sorted = sorted(regions, key=lambda r: r["w"] * r["h"], reverse=True)
    for r in regions_sorted:
        rx1, ry1 = r["x"], r["y"]
        rx2, ry2 = rx1 + r["w"], ry1 + r["h"]
        dominated = False
        for k in keep:
            kx1, ky1 = k["x"], k["y"]
            kx2, ky2 = kx1 + k["w"], ky1 + k["h"]
            ix = max(0, min(rx2, kx2) - max(rx1, kx1))
            iy = max(0, min(ry2, ky2) - max(ry1, ky1))
            inter = ix * iy
            smaller = min(r["w"] * r["h"], k["w"] * k["h"])
            if smaller > 0 and inter / smaller > overlap_thresh:
                dominated = True
                break
        if not dominated:
            keep.append(r)
    return keep


# ─────────────────────────────────────────────
#  Public API
# ─────────────────────────────────────────────
def segment_words(image_bgr: np.ndarray) -> List[Dict]:
    """
    Segment an inscription image into character-level bounding boxes.

    Works on stone inscriptions of any size, lighting, noise, or quality.

    Args:
        image_bgr: BGR numpy array (uint8).

    Returns:
        List of dicts, each with:
            id    : int          — 1-indexed sequential id
            x, y  : int         — top-left corner (original image coords)
            w, h  : int         — width / height (original image coords)
            line  : int         — 1-indexed line number
            crop  : np.ndarray  — BGR crop at original resolution
    """
    # ── Handle edge-case input formats ────────────────────────────────────────
    if len(image_bgr.shape) == 3 and image_bgr.shape[2] == 4:
        image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_BGRA2BGR)
    if len(image_bgr.shape) == 2:
        image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_GRAY2BGR)

    print(f"[SEG] Input image shape: {image_bgr.shape}")
    orig = image_bgr
    orig_h, orig_w = orig.shape[:2]

    # ── STEP 1: Resize to working resolution ──────────────────────────────────
    image_work = _resize_to_max(orig, max_width=1200)
    work_h, work_w = image_work.shape[:2]

    # Scale factors: work-space → original-image coords
    sx_orig = orig_w / work_w
    sy_orig = orig_h / work_h

    _save_debug_step("01_resized.jpg", image_work)

    # ── STEP 2: Convert to grayscale ──────────────────────────────────────────
    gray = cv2.cvtColor(image_work, cv2.COLOR_BGR2GRAY)
    _save_debug_step("02_gray.jpg", gray)

    # ── STEP 3: Detect image type ─────────────────────────────────────────────
    img_type = _detect_image_type(gray)
    print(f"[SEG] Detected image type: {img_type}")

    # ── STEP 4: Adaptive pre-processing to get a binary mask ─────────────────
    binary = _preprocess_stone(gray, img_type)
    _save_debug_step("03_binary.jpg", binary)

    # ── STEP 5: Compute adaptive parameters ──────────────────────────────────
    params = _compute_adaptive_params(work_w, work_h, img_type)
    print(f"[SEG] Adaptive params: {params}")

    # ── STEP 6: Zero out border region ───────────────────────────────────────
    border = params["border"]
    binary[:border, :]  = 0
    binary[-border:, :] = 0
    binary[:, :border]  = 0
    binary[:, -border:] = 0

    # ── STEP 7: Morphological dilation to connect character strokes ───────────
    k_word = cv2.getStructuringElement(
        cv2.MORPH_RECT, (params["k_w"], params["k_h"])
    )
    dilated = cv2.dilate(binary, k_word, iterations=1)
    _save_debug_step("04_dilated.jpg", dilated)

    # ── STEP 8: Find contours ────────────────────────────────────────────────
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    print(f"[SEG] Total contours found: {len(contours)}")

    min_w   = params["min_w"]
    min_h   = params["min_h"]
    min_area = params["min_area"]
    max_w   = params["max_w"]
    max_h   = params["max_h"]

    regions_work: List[Dict] = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h

        # Reject border-touching contours
        if x < border or y < border:
            continue
        if (x + w) > (work_w - border):
            continue
        if (y + h) > (work_h - border):
            continue

        # Reject too large blobs (noise or background cracks)
        if w > max_w or h > max_h:
            continue

        # Reject extreme aspect ratios (long horizontal cracks)
        aspect = w / h if h > 0 else 999
        if aspect > 8 or aspect < 0.1:
            continue

        # Reject tiny noise
        if w < min_w or h < min_h:
            continue

        if area < min_area:
            continue

        regions_work.append({"x": x, "y": y, "w": w, "h": h, "line": 0})

    print(f"[SEG] After strict filter: {len(regions_work)} regions")

    # ── STEP 9: Remove overlapping boxes ─────────────────────────────────────
    regions_work = _remove_overlaps(regions_work, overlap_thresh=0.4)
    print(f"[SEG] After overlap removal: {len(regions_work)} regions")

    if not regions_work:
        print("[SEG] WARNING: No regions detected. Returning empty list.")
        return []

    # ── STEP 10: Cluster regions into lines ───────────────────────────────────
    # Sort by y-center
    regions_work.sort(key=lambda r: r["y"] + r["h"] / 2)

    # Adaptive line gap: if not many regions, use larger gap to merge stray boxes
    line_gap = params["line_gap"]
    if len(regions_work) < 10:
        line_gap = max(line_gap, work_h // 8)

    line_num = 1
    current_line_yc = regions_work[0]["y"] + regions_work[0]["h"] / 2
    for r in regions_work:
        y_center = r["y"] + r["h"] / 2
        if y_center - current_line_yc > line_gap:
            line_num += 1
            current_line_yc = y_center
        r["line"] = line_num

    print(f"[SEG] Lines detected: {line_num}")

    # ── STEP 11: Sort by line then x ─────────────────────────────────────────
    regions_work.sort(key=lambda r: (r["line"], r["x"]))
    for i, r in enumerate(regions_work):
        r["_id"] = i + 1

    # ── STEP 12: Build output list and debug visualization ───────────────────
    LINE_COLORS = [
        (0,   0,   255),
        (0,   200,   0),
        (255,   0,   0),
        (0,   200, 200),
        (200,   0, 200),
        (0,   165, 255),
        (128,   0, 128),
        (0,   128, 128),
        (255, 165,   0),
        (0,   255, 165),
    ]

    output: List[Dict] = []
    debug_vis = orig.copy()

    for r in regions_work:
        rx, ry, rw, rh = r["x"], r["y"], r["w"], r["h"]
        region_id = r["_id"]
        color = LINE_COLORS[(r["line"] - 1) % len(LINE_COLORS)]

        # Map work-space → original image coordinates
        ox = int(rx * sx_orig)
        oy = int(ry * sy_orig)
        ow = int(rw * sx_orig)
        oh = int(rh * sy_orig)

        # Clamp to image bounds
        x1 = max(0, ox)
        y1 = max(0, oy)
        x2 = min(orig_w, ox + ow)
        y2 = min(orig_h, oy + oh)
        crop = orig[y1:y2, x1:x2]

        output.append({
            "id":   region_id,
            "x":    ox,
            "y":    oy,
            "w":    ow,
            "h":    oh,
            "line": r["line"],
            "crop": crop,
        })

        # Draw colored rectangle and label on debug image
        cv2.rectangle(debug_vis, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            debug_vis, str(region_id),
            (x1, max(y1 - 3, 10)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1, cv2.LINE_AA,
        )

    _save_debug_step("05_result.jpg", debug_vis)
    print(f"[SEG] Final regions returned: {len(output)}")
    return output
