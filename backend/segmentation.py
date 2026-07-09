"""
segmentation.py — Adaptive Character-level Region Extraction for Stone Inscriptions.

Robust Pipeline (works on any inscription size, lighting, noise level):
  1  Resize to max 1400px width (preserve aspect ratio)
  2  Convert to grayscale
  3  Detect image type: clean doc / photo_of_doc / dark doc / stone inscription
  4  Apply adaptive pre-processing based on type:
       - Stone inscriptions: CLAHE + adaptive threshold (NO close kernel)
       - Clean documents: Otsu threshold directly
  5  Mild dilation (iterations=1) to barely connect strokes within one character
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
    photo-of-document, or a stone inscription.
    """
    h, w = gray.shape

    # Sample 5% border strip on all 4 sides
    bw = max(10, w // 20)
    bh = max(10, h // 20)

    border_pixels = np.concatenate([
        gray[:bh, :].ravel(),
        gray[-bh:, :].ravel(),
        gray[:, :bw].ravel(),
        gray[:, -bw:].ravel(),
    ])

    bg_brightness = float(np.median(border_pixels))

    interior = gray[bh:-bh, bw:-bw]
    interior_std  = float(interior.std())
    interior_mean = float(interior.mean())

    lap_var = float(cv2.Laplacian(interior, cv2.CV_64F).var())

    print(f"[SEG] bg_median={bg_brightness:.1f} interior_mean={interior_mean:.1f} "
          f"interior_std={interior_std:.1f} lap_var={lap_var:.1f}")

    # Phone-camera photo of a document (dark border + bright interior)
    if bg_brightness < 60 and interior_mean > 150:
        return "photo_of_doc"

    if bg_brightness > 200 and interior_std > 20:
        return "clean_document"

    elif bg_brightness < 60:
        return "dark_document"

    else:
        return "stone_inscription"


def _preprocess_stone(gray: np.ndarray, img_type: str) -> np.ndarray:
    """
    Returns a clean binary mask where characters are WHITE (foreground).
    Applies different pre-processing strategies per image type.

    KEY RULE for stone inscriptions:
      - Do NOT use a morphological CLOSE here — that merges nearby characters.
      - Do NOT use large black-hat kernels — they group entire text rows.
      - The dilation step in segment_words() is the ONLY place we expand blobs.
    """

    if img_type == "clean_document":
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k_open, iterations=1)
        return binary

    elif img_type == "photo_of_doc":
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        adaptive = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            blockSize=31, C=10
        )
        _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        binary = cv2.bitwise_or(adaptive, otsu)
        k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k_open, iterations=1)
        return binary

    elif img_type == "dark_document":
        inverted = cv2.bitwise_not(gray)
        blurred = cv2.GaussianBlur(inverted, (5, 5), 0)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return binary

    else:
        # ══════════════════════════════════════════════════════════════
        # stone_inscription — CLEAN single-threshold pipeline
        #
        # Key insight:
        #   The previous OR of 3 methods created noise everywhere → 13 chars
        #   The previous AND of adapt+Otsu was too strict in dim areas → 80 chars
        #   Root fix: use AGGRESSIVE CLAHE to normalise illumination FIRST,
        #   then ONE well-tuned adaptive threshold at character scale.
        #   After CLAHE the illumination is even, so Otsu is unnecessary.
        #
        # The adaptive block size = ~line-pitch scale (larger than 1 character).
        # This means: grain (sub-character scale) is averaged away by the block,
        # while characters (which are darker than their full-line neighbourhood)
        # are reliably detected.
        # ══════════════════════════════════════════════════════════════

        h, w = gray.shape

        # ── Step A: Bilateral denoise (edge-preserving) ─────────────────
        denoised = cv2.bilateralFilter(gray, d=9, sigmaColor=60, sigmaSpace=60)
        _save_debug_step("02a_denoised.jpg", denoised)

        # ── Step B: AGGRESSIVE CLAHE — normalise illumination completely ──
        # clipLimit=5 + small tile (4x4) = maximum local contrast boost.
        # After this step the stone background brightness is equalised across
        # the whole slab, so a single global-style threshold can work.
        clahe = cv2.createCLAHE(clipLimit=5.0, tileGridSize=(4, 4))
        clahe_img = clahe.apply(denoised)
        _save_debug_step("02b_clahe.jpg", clahe_img)

        # ── Step C: Single adaptive threshold at LINE-PITCH scale ─────────
        # blockSize ≈ 2.5× estimated character width (= line-pitch scale).
        # At this scale: the "local mean" is the average brightness of
        # an entire character row. Carved grooves (chars) are darker than
        # this mean; stone grain is NOT darker (grain is tiny, averages out).
        char_w_est = max(20, w // 28)         # ~50px at 1400px
        block_size = int(char_w_est * 2.5) | 1  # ~125px, odd
        block_size = max(block_size, 41)       # minimum 41

        # Auto-tune C: start sensitive (C=4), raise if too much foreground.
        # Target: 6% – 30% foreground (characters only, not grain).
        k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        best_binary = None
        for C_val in [4, 6, 8, 11, 15]:
            candidate = cv2.adaptiveThreshold(
                clahe_img, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY_INV,
                blockSize=block_size, C=C_val
            )
            # Small opening: remove isolated grain pixels
            candidate = cv2.morphologyEx(candidate, cv2.MORPH_OPEN, k_open, iterations=1)
            fg = cv2.countNonZero(candidate) / candidate.size
            print(f"[SEG] C={C_val}: foreground={fg:.1%} (block={block_size})")
            best_binary = candidate
            if fg <= 0.30:   # acceptable range reached
                break

        _save_debug_step("02c_adaptive.jpg", best_binary)
        return best_binary


def _compute_adaptive_params(img_w: int, img_h: int, img_type: str = "stone_inscription") -> dict:
    """
    Compute morphological and size filter parameters based on image size and type.

    For stone inscriptions the dilation kernel must be SMALL enough that
    adjacent characters don't merge — the binary preprocessing already
    removed the noise, so we only need to connect strokes WITHIN one character.
    """
    estimated_char_w = max(15, img_w // 30)   # ~47px at 1400px
    estimated_char_h = max(15, img_h // 10)   # depends on aspect ratio

    if img_type in ("clean_document", "photo_of_doc"):
        # Printed text: characters already well-separated — MINIMAL dilation
        k_w = 2
        k_h = 1
        min_w  = max(5,  img_w // 80)
        min_h  = max(5,  img_h // 40)
        min_area = min_w * min_h
        max_w  = int(img_w * 0.15)
        max_h  = int(img_h * 0.20)
        border = max(5, int(min(img_w, img_h) * 0.01))
        line_gap = max(10, int(estimated_char_h * 0.4))
    else:
        # Stone inscriptions:
        # k_w: bridges intra-character stroke breaks (1–5px gaps in carved grooves)
        #       must NOT bridge inter-character gaps (~8–20px between chars)
        # Sweet spot: k_w = 4–6px at 1400px working width
        k_w = min(6, max(3, int(estimated_char_w * 0.12)))   # ~5px at 1400px
        k_h = min(3, max(2, int(estimated_char_h * 0.08)))   # ~2–3px

        if img_w < 300:
            min_w, min_h = 6, 6
            min_area = 36
        elif img_w < 600:
            min_w, min_h = 10, 10
            min_area = 120
        else:
            min_w, min_h = 14, 14    # 14×14px minimum — avoids grain noise
            min_area = 250           # smaller than before: catches fine characters

        max_w  = int(img_w * 0.22)   # single char max ~22% of width
        max_h  = int(img_h * 0.38)   # single char max ~38% of height
        border = max(10, int(min(img_w, img_h) * 0.01))    # reduced: don't cut edge chars
        line_gap = max(12, int(estimated_char_h * 0.38))

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

    Args:
        image_bgr: BGR numpy array (uint8).

    Returns:
        List of dicts with: id, x, y, w, h, line, crop
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
    image_work = _resize_to_max(orig, max_width=1400)
    work_h, work_w = image_work.shape[:2]

    sx_orig = orig_w / work_w
    sy_orig = orig_h / work_h

    _save_debug_step("01_resized.jpg", image_work)

    # ── STEP 2: Convert to grayscale ──────────────────────────────────────────
    gray = cv2.cvtColor(image_work, cv2.COLOR_BGR2GRAY)
    _save_debug_step("02_gray.jpg", gray)

    # ── STEP 3: Detect image type ─────────────────────────────────────────────
    img_type = _detect_image_type(gray)
    print(f"[SEG] Detected image type: {img_type}")

    # ── STEP 4: Adaptive pre-processing → binary mask ─────────────────────────
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

    # ── STEP 7: Mild dilation — connect strokes WITHIN a character only ────────
    # iterations=1 with small kernel: just bridges micro-gaps inside one character
    # iterations=2 or wide kernel WILL merge adjacent characters — avoid it
    k_word = cv2.getStructuringElement(
        cv2.MORPH_RECT, (params["k_w"], params["k_h"])
    )
    dilated = cv2.dilate(binary, k_word, iterations=1)
    _save_debug_step("04_dilated.jpg", dilated)

    # ── STEP 8: Find contours ────────────────────────────────────────────────
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    print(f"[SEG] Total contours found: {len(contours)}")

    min_w    = params["min_w"]
    min_h    = params["min_h"]
    min_area = params["min_area"]
    max_w    = params["max_w"]
    max_h    = params["max_h"]

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

        # Reject too large blobs (merged characters, background patches)
        if w > max_w or h > max_h:
            continue

        # Reject extreme aspect ratios (cracks, hairlines)
        aspect = w / h if h > 0 else 999
        if aspect > 8.0 or aspect < 0.12:
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
    regions_work.sort(key=lambda r: r["y"] + r["h"] / 2)

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

    # ── STEP 12: Build output + debug visualization ───────────────────────────
    LINE_COLORS = [
        (0,   0,   255), (0,   200,   0), (255,   0,   0),
        (0,   200, 200), (200,   0, 200), (0,   165, 255),
        (128,   0, 128), (0,   128, 128), (255, 165,   0),
        (0,   255, 165),
    ]

    output: List[Dict] = []
    debug_vis = orig.copy()

    for r in regions_work:
        rx, ry, rw, rh = r["x"], r["y"], r["w"], r["h"]
        region_id = r["_id"]
        color = LINE_COLORS[(r["line"] - 1) % len(LINE_COLORS)]

        ox = int(rx * sx_orig)
        oy = int(ry * sy_orig)
        ow = int(rw * sx_orig)
        oh = int(rh * sy_orig)

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

        cv2.rectangle(debug_vis, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            debug_vis, str(region_id),
            (x1, max(y1 - 3, 10)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1, cv2.LINE_AA,
        )

    _save_debug_step("05_result.jpg", debug_vis)
    print(f"[SEG] Final regions returned: {len(output)}")
    return output
