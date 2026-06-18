"""
Ancient Tamil Inscription Translator — Segmentation Module
Segments a stone inscription photo into individual word/character regions.

Key insight: heavy Gaussian blur FIRST to kill stone texture noise,
THEN threshold — so only actual carved characters remain in the binary.
"""

from typing import List, Dict
from pathlib import Path

import numpy as np
import cv2

DEBUG_DIR  = Path(r"E:\TAMIL SCRIPT VERSION 2\debug")
DEBUG_PATH = Path(r"E:\TAMIL SCRIPT VERSION 2\debug_segmentation.png")


# ─────────────────────────────────────────────
#  INTERNAL HELPERS
# ─────────────────────────────────────────────
def _save_debug_step(name: str, img: np.ndarray):
    """Save an intermediate pipeline image to the debug folder."""
    try:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        path = DEBUG_DIR / name
        cv2.imwrite(str(path), img)
    except Exception as e:
        print(f"[DEBUG] Could not save {name}: {e}")


def _resize_to_max(image: np.ndarray, max_width: int = 1000) -> np.ndarray:
    """Downscale so width ≤ max_width, preserving aspect ratio."""
    h, w = image.shape[:2]
    if w <= max_width:
        return image
    scale  = max_width / w
    new_w  = max_width
    new_h  = int(h * scale)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)


# ─────────────────────────────────────────────
#  MAIN FUNCTION
# ─────────────────────────────────────────────
def segment_words(image_bgr: np.ndarray) -> List[Dict]:
    """
    Segment an inscription image into word/character regions.

    Parameters
    ----------
    image_bgr : np.ndarray
        Input image in BGR format (as loaded by OpenCV).

    Returns
    -------
    List[Dict]
        Reading-order list of region dicts, each containing:
            id    : int         — 1-indexed reading-order position
            x, y  : int         — top-left corner (original image coords)
            w, h  : int         — width / height (original image coords)
            line  : int         — 1-indexed line number
            crop  : np.ndarray  — BGR crop at original resolution
    """

    # Handle BGRA (4 channel) images from some uploads
    if len(image_bgr.shape) == 3 and image_bgr.shape[2] == 4:
        image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_BGRA2BGR)
    
    # Handle grayscale input
    if len(image_bgr.shape) == 2:
        image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_GRAY2BGR)

    print(f"[SEG] Input image shape: {image_bgr.shape}")

    orig      = image_bgr
    orig_h, orig_w = orig.shape[:2]

    # ── STEP 1 - Resize to max 1200px width, keep color image
    image_resized = _resize_to_max(orig, max_width=1200)
    work_h, work_w = image_resized.shape[:2]
    
    # Scale factors: work-space → original-image coords
    sx_orig = orig_w / work_w
    sy_orig = orig_h / work_h

    # ── STEP 2 - Convert to grayscale and invert
    gray = cv2.cvtColor(image_resized, cv2.COLOR_BGR2GRAY)
    _save_debug_step("01_gray.jpg", gray)
    
    inverted = cv2.bitwise_not(gray)
    _save_debug_step("02_inverted.jpg", inverted)

    # ── STEP 3 - Strong blur and CLAHE
    blurred = cv2.GaussianBlur(inverted, (21, 21), 0)
    _save_debug_step("03_blurred.jpg", blurred)
    
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blurred)
    _save_debug_step("04_enhanced.jpg", enhanced)

    # ── STEP 4 & 5 - Threshold and Foreground Check
    _, binary = cv2.threshold(enhanced, 127, 255, cv2.THRESH_BINARY)
    fg_pct = cv2.countNonZero(binary) / binary.size
    print(f"[SEG] Foreground after threshold 127: {fg_pct:.1%}")
    
    if fg_pct > 0.4:
        _, binary = cv2.threshold(enhanced, 150, 255, cv2.THRESH_BINARY)
        fg_pct = cv2.countNonZero(binary) / binary.size
        print(f"[SEG] Foreground after threshold 150: {fg_pct:.1%}")
    
    if fg_pct > 0.6:
        _, binary = cv2.threshold(enhanced, 170, 255, cv2.THRESH_BINARY)
        fg_pct = cv2.countNonZero(binary) / binary.size
        print(f"[SEG] Foreground after threshold 170: {fg_pct:.1%}")
        
    _save_debug_step("05_binary.jpg", binary)

    # ── STEP 6 - Adaptive border rejection
    img_h, img_w = image_resized.shape[:2]
    border = max(5, min(img_w, img_h) // 30)
    binary[:border, :] = 0
    binary[-border:, :] = 0
    binary[:, :border] = 0
    binary[:, -border:] = 0

    # ── STEP 7 - Morphological opening
    k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k_open, iterations=2)
    _save_debug_step("06_opened.jpg", opened)

    # ── STEP 8 - Adaptive dilation kernel based on image width
    if img_w < 300:
        k_w, k_h = 3, 2
        min_w, min_h = 10, 10
        min_area = 100
    elif img_w < 600:
        k_w, k_h = 5, 2
        min_w, min_h = 15, 15
        min_area = 300
    else:
        k_w, k_h = 6, 2
        min_w, min_h = 25, 25
        min_area = 800

    print(f"[SEG] Image size: {img_w}x{img_h}, kernel: ({k_w},{k_h}), border: {border}, min_w/h: {min_w}/{min_h}")
    k_word = cv2.getStructuringElement(cv2.MORPH_RECT, (k_w, k_h))
    dilated = cv2.dilate(opened, k_word, iterations=1)
    _save_debug_step("07_dilated.jpg", dilated)

    # ── STEP 9 - Find contours and filter
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    print(f"[SEG] After dilation — total contours: {len(contours)}")
    
    regions_work = []

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h

        # Reject border-touching contours (adaptive border margin)
        if x < border or y < border:
            continue
        if (x + w) > (img_w - border):
            continue
        if (y + h) > (img_h - border):
            continue

        # Reject if too tall (more than 1 row height = img_h/6)
        if h > img_h / 6:
            continue

        # Reject if too wide (more than 2 words wide = img_w/6)  
        if w > img_w / 6:
            continue

        # Reject tiny noise (adaptive min size)
        if w < min_w or h < min_h:
            continue

        # Reject if area too small (adaptive)
        if area < min_area:
            continue

        regions_work.append({
            "x": x, "y": y, "w": w, "h": h,
            "line": 0
        })

    print(f"[SEG] After strict filter — regions: {len(regions_work)}")
    print(f"[SEG] Before overlap removal: {len(regions_work)}")

    # ── STEP 9b - Remove overlapping boxes (keep larger)
    def remove_overlaps(regions, overlap_thresh=0.3):
        keep = []
        regions_sorted = sorted(regions, key=lambda r: r['w'] * r['h'], reverse=True)
        for r in regions_sorted:
            rx1, ry1, rx2, ry2 = r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']
            dominated = False
            for k in keep:
                kx1, ky1, kx2, ky2 = k['x'], k['y'], k['x'] + k['w'], k['y'] + k['h']
                ix = max(0, min(rx2, kx2) - max(rx1, kx1))
                iy = max(0, min(ry2, ky2) - max(ry1, ky1))
                inter = ix * iy
                smaller = min(r['w'] * r['h'], k['w'] * k['h'])
                if smaller > 0 and inter / smaller > overlap_thresh:
                    dominated = True
                    break
            if not dominated:
                keep.append(r)
        return keep

    regions_work = remove_overlaps(regions_work, overlap_thresh=0.3)
    print(f"[SEG] After overlap removal: {len(regions_work)}")

    # ── STEP 9c - Re-assign lines using y-center (35px tolerance)
    regions_work.sort(key=lambda r: r['y'] + r['h'] // 2)
    line_num = 1
    if regions_work:
        current_line_yc = regions_work[0]['y'] + regions_work[0]['h'] // 2
        for r in regions_work:
            y_center = r['y'] + r['h'] // 2
            if y_center - current_line_yc > 35:
                line_num += 1
                current_line_yc = y_center
            r['line'] = line_num

    print(f"[SEG] Lines detected: {max(r['line'] for r in regions_work) if regions_work else 0}")

    # ── STEP 9d - Re-number ids sequentially, sort by line then x
    regions_work.sort(key=lambda r: (r['line'], r['x']))
    for i, r in enumerate(regions_work):
        r['_id'] = i + 1

    # Build output & Draw debug image on ORIGINAL color image
    # Color palette for line-number color coding
    LINE_COLORS = [
        (0,   0,   255),   # line 1 — red
        (0,   200,  0),    # line 2 — green
        (255,  0,   0),    # line 3 — blue
        (0,   200, 200),   # line 4 — yellow
        (200,  0,  200),   # line 5 — magenta
        (0,   165, 255),   # line 6 — orange
        (128,  0,  128),   # line 7 — purple
        (0,   128, 128),   # line 8 — teal
    ]

    output: List[Dict] = []
    filt_vis = orig.copy()
    
    for r in regions_work:
        rx, ry, rw, rh = r["x"], r["y"], r["w"], r["h"]
        region_id = r['_id']
        line_idx   = (r['line'] - 1) % len(LINE_COLORS)
        color      = LINE_COLORS[line_idx]
        
        # Map work-space coords → original image coords
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
        
        # Draw on original color image — color-coded by line
        cv2.rectangle(filt_vis, (x1, y1), (x2, y2), color, 2)
        cv2.putText(filt_vis, str(region_id), (x1, max(y1 - 3, 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2, cv2.LINE_AA)

    _save_debug_step("08_result.jpg", filt_vis)
    print(f"[SEG] Final regions returned: {len(output)}")

    return output
