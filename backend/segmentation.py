"""
segmentation.py -- Universal Character-level Region Extraction.

Works on ALL inscription types:
  - Colour stone slab photos (orange/tan stone, carved grooves)
  - Black-and-white scanned inscription documents
  - Clean printed document images
  - Dark background images
  - Phone-camera photos of documents

Pipeline:
  1  Resize to max 1800px (preserve aspect ratio)
  2  Convert to grayscale
  3  Detect image type from statistical features
  4  Run ALL applicable preprocessing strategies, pick the best
  5  Dilate (connect strokes within characters only)
  6  Find + filter contours by size / aspect ratio
  7  Remove overlapping boxes (IoU)
  8  Cluster into lines, sort by line then x
  9  Map back to original resolution
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

# Use lightweight pure OpenCV contour segmentation by default (keeps RAM < 125MB for 100% free hosting)
_ENABLE_HEAVY_YOLO = os.environ.get("ENABLE_YOLO", "false").lower() in ("true", "1", "yes")

_YOLO_MODEL = None
_YOLO_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "best.pt")
if not os.path.exists(_YOLO_PATH):
    _YOLO_PATH = os.path.join(os.path.dirname(__file__), "best.pt")

if _ENABLE_HEAVY_YOLO and YOLO and os.path.exists(_YOLO_PATH):
    try:
        _YOLO_MODEL = YOLO(_YOLO_PATH)
        print(f"[SEG] Loaded YOLO model from {_YOLO_PATH}")
    except Exception as e:
        print(f"[WARN] Failed to load YOLO model: {e}")
else:
    print("[INFO] Lightweight OpenCV Contour Mode active (optimized for free-tier 512MB RAM servers).")

# ---------------------------------------------
#  Optional debug image saving
# ---------------------------------------------
_DEBUG_DIR: Optional[str] = os.environ.get("SEG_DEBUG_DIR", "")


def _save_debug(filename: str, img: np.ndarray) -> None:
    if not _DEBUG_DIR:
        return
    os.makedirs(_DEBUG_DIR, exist_ok=True)
    cv2.imwrite(os.path.join(_DEBUG_DIR, filename), img)


# ---------------------------------------------
#  Resize helper
# ---------------------------------------------
def _resize_to_max(img: np.ndarray, max_width: int) -> np.ndarray:
    h, w = img.shape[:2]
    if w <= max_width:
        return img.copy()
    scale = max_width / w
    return cv2.resize(img, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)


# ---------------------------------------------
#  Image type detection
# ---------------------------------------------
def _detect_image_type(gray: np.ndarray) -> str:
    """
    Classify image into: clean_document, dark_document, photo_of_doc, stone_colour, stone_bw
    """
    h, w = gray.shape
    bw = min(max(1, w // 20), max(0, w // 4 - 1))
    bh = min(max(1, h // 20), max(0, h // 4 - 1))

    border_px = np.concatenate([
        gray[:max(1, bh), :].ravel(),
        gray[-max(1, bh):, :].ravel(),
        gray[:, :max(1, bw)].ravel(),
        gray[:, -max(1, bw):].ravel(),
    ])

    bg_med = float(np.median(border_px)) if border_px.size > 0 else float(np.median(gray))
    interior = gray[bh:-bh, bw:-bw] if (h - 2 * bh > 2 and w - 2 * bw > 2) else gray

    if interior.size == 0 or interior.shape[0] < 3 or interior.shape[1] < 3:
        interior = gray

    int_mean    = float(interior.mean())
    int_std     = float(interior.std())
    lap_var     = float(cv2.Laplacian(interior, cv2.CV_64F).var())

    # Texture: absdiff between raw and blurred
    blurred_t   = cv2.GaussianBlur(interior, (5, 5), 0)
    texture_val = float(cv2.absdiff(interior, blurred_t).mean())

    print(f"[SEG] type-detect: bg={bg_med:.1f} int_mean={int_mean:.1f} "
          f"int_std={int_std:.1f} lap={lap_var:.0f} tex={texture_val:.1f}")

    # --- Rules (ordered from most specific to least) ---

    # 1. Phone photo of clean document (dark vignette border, bright centre)
    if bg_med < 60 and int_mean > 150:
        return "photo_of_doc"

    # 2. Clean white-paper document (very bright bg, moderate std)
    if bg_med > 200 and int_std > 15:
        return "clean_document"

    # 3. Dark/inverted document
    if bg_med < 60 and int_mean < 100:
        return "dark_document"

    # 4. Black & white inscription scan / high-contrast document
    #    (mid-bright bg, low texture but high contrast between black strokes & white bg)
    if int_std > 60 and texture_val < 8 and bg_med > 100:
        return "bw_inscription"

    # 5. Colour stone slab (any other mid-gray/orange image with significant texture)
    return "stone_colour"


# ---------------------------------------------
#  Preprocessing strategies
# ---------------------------------------------

def _strategy_otsu(gray: np.ndarray) -> np.ndarray:
    """Simple Otsu – best for clean high-contrast images."""
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return binary


def _strategy_adaptive(gray: np.ndarray, block: int, C: int) -> np.ndarray:
    """Adaptive Gaussian threshold."""
    block = block | 1           # must be odd
    block = max(block, 11)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    return cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=block, C=C
    )


def _strategy_clahe_adaptive(gray: np.ndarray, clip: float, tile: int,
                              block: int, C: int) -> np.ndarray:
    """CLAHE normalisation -> adaptive threshold."""
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile))
    enhanced = clahe.apply(gray)
    block = block | 1
    block = max(block, 11)
    return cv2.adaptiveThreshold(
        enhanced, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=block, C=C
    )


def _strategy_blackhat(gray: np.ndarray, kernel_size: int) -> np.ndarray:
    """
    Black-hat morphology: extracts dark carved grooves from stone background.
    black_hat = morphological_close(img) - img
    Then Otsu on that.
    """
    kernel_size = kernel_size | 1
    kernel_size = max(kernel_size, 15)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, k)
    # Boost contrast
    blackhat = cv2.normalize(blackhat, None, 0, 255, cv2.NORM_MINMAX)
    _, binary = cv2.threshold(blackhat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def _strategy_canny_fill(gray: np.ndarray) -> np.ndarray:
    """Canny edges -> dilate -> fill contours -> threshold. Good for faint grooves."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 20, 60)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated_edges = cv2.dilate(edges, k, iterations=1)
    return dilated_edges


def _apply_open(binary: np.ndarray, ksize: int = 2) -> np.ndarray:
    """Small morphological open to remove isolated single-pixel noise."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    return cv2.morphologyEx(binary, cv2.MORPH_OPEN, k, iterations=1)


def _score_binary(binary: np.ndarray, min_area: int, max_area: int,
                  min_w: int, min_h: int, max_w: int, max_h: int) -> int:
    """
    Score a binary mask by counting plausible character-sized contours.
    Higher = better binary for character segmentation.
    """
    cnts, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    count = 0
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        if area < min_area or area > max_area:
            continue
        if w < min_w or h < min_h:
            continue
        if w > max_w or h > max_h:
            continue
        asp = w / h if h > 0 else 999
        if asp > 7.0 or asp < 0.14:
            continue
        count += 1
    return count


# ---------------------------------------------
#  Master preprocessing dispatcher
# ---------------------------------------------

def _best_binary(gray: np.ndarray, img_type: str, img_w: int, img_h: int) -> np.ndarray:
    """
    Run multiple preprocessing strategies. Score each by plausible character count.
    Return the binary that yields the most characters.
    Guaranteed to always return something (falls back to Otsu).
    """

    char_w_est = max(15, img_w // 30)
    char_h_est = max(15, img_h // 10)

    # Scoring parameters (loose -- just to rank strategies, strict filter happens later)
    score_params = dict(
        min_area = max(30,  char_w_est * char_h_est // 12),
        max_area = int(img_w * img_h * 0.08),
        min_w    = max(5,   char_w_est // 4),
        min_h    = max(5,   char_h_est // 4),
        max_w    = int(img_w * 0.35),
        max_h    = int(img_h * 0.55),
    )

    denoised_mild   = cv2.GaussianBlur(gray, (3, 3), 0)
    denoised_strong = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    k_open2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))

    candidates: List[Tuple[str, np.ndarray]] = []

    if img_type == "clean_document":
        candidates.append(("otsu",         _apply_open(_strategy_otsu(gray), 2)))
        candidates.append(("adapt_31_8",   _apply_open(_strategy_adaptive(gray, 31, 8), 2)))
        candidates.append(("adapt_51_10",  _apply_open(_strategy_adaptive(gray, 51, 10), 2)))

    elif img_type == "photo_of_doc":
        candidates.append(("clahe_adapt",  _apply_open(_strategy_clahe_adaptive(gray, 3.0, 8, 31, 8), 2)))
        candidates.append(("otsu",         _apply_open(_strategy_otsu(gray), 2)))
        b1 = _strategy_adaptive(denoised_mild, 31, 10)
        b2 = _strategy_otsu(denoised_mild)
        candidates.append(("or_adapt_otsu", _apply_open(cv2.bitwise_or(b1, b2), 2)))

    elif img_type == "dark_document":
        inv = cv2.bitwise_not(gray)
        candidates.append(("inv_otsu",     _apply_open(_strategy_otsu(inv), 2)))
        candidates.append(("inv_adapt",    _apply_open(_strategy_adaptive(inv, 31, 8), 2)))

    elif img_type == "bw_inscription":
        # B&W scan: Otsu is usually perfect
        candidates.append(("otsu",         _apply_open(_strategy_otsu(gray), 2)))
        candidates.append(("adapt_lrg_4",  _apply_open(_strategy_adaptive(gray, char_w_est * 3, 4), 2)))
        candidates.append(("clahe4_adapt", _apply_open(_strategy_clahe_adaptive(gray, 4.0, 4, char_w_est * 3, 4), 2)))

    else:
        # stone_colour -- most complex case
        # Bilateral denoise first to preserve carved groove edges
        bil = denoised_strong

        # CLAHE variants (different tile sizes)
        for clip, tile, blk_mult, C in [
            (3.0, 16, 2.5, 5),
            (3.0, 16, 2.0, 4),
            (4.0,  8, 2.5, 6),
            (5.0,  4, 3.0, 8),
            (3.0, 16, 3.0, 7),
        ]:
            block = int(char_w_est * blk_mult) | 1
            b = _apply_open(_strategy_clahe_adaptive(bil, clip, tile, block, C), 2)
            candidates.append((f"clahe{clip}_{tile}_{C}", b))

        # Black-hat variants
        for bh_mult in [0.7, 1.0, 1.4]:
            bh_k = int(char_w_est * bh_mult)
            clahe_img = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(16, 16)).apply(bil)
            blackhat_b = _apply_open(_strategy_blackhat(clahe_img, bh_k), 2)
            candidates.append((f"blackhat_{bh_mult}", blackhat_b))

        # OR of CLAHE-adaptive + blackhat  (catches both faint and deep grooves)
        clahe_img2 = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(16, 16)).apply(bil)
        bh_base   = _strategy_blackhat(clahe_img2, int(char_w_est * 0.9))
        blk2      = int(char_w_est * 2.5) | 1
        adapt_base = _strategy_clahe_adaptive(bil, 3.0, 16, blk2, 5)
        combo      = cv2.bitwise_or(bh_base, adapt_base)
        candidates.append(("bh_or_adapt", _apply_open(combo, 2)))

        # Canny edges fallback
        candidates.append(("canny", _apply_open(_strategy_canny_fill(bil), 2)))

    # -- Score all candidates and pick the best ----------------------------
    best_name   = None
    best_binary = None
    best_score  = -1

    for name, binary in candidates:
        score = _score_binary(binary, **score_params)
        fg_pct = cv2.countNonZero(binary) / binary.size
        print(f"[SEG]   strategy={name:<24} score={score:>4}  fg={fg_pct:.1%}")
        if score > best_score:
            best_score  = score
            best_binary = binary
            best_name   = name

    print(f"[SEG] Best strategy: {best_name}  score={best_score}")

    if best_binary is None:
        # Ultimate fallback
        _, best_binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    _save_debug("03_best_binary.jpg", best_binary)
    return best_binary


# ---------------------------------------------
#  Overlap removal
# ---------------------------------------------

def _remove_overlaps(regions: List[Dict], overlap_thresh: float = 0.75) -> List[Dict]:
    """Remove duplicate boxes using true Intersection-over-Union (IoU), prioritizing character-sized boxes."""
    if not regions:
        return []
    
    # Sort regions by closeness to median character area so standard character boxes are evaluated first
    areas = [r["w"] * r["h"] for r in regions]
    median_area = float(np.median(areas)) if areas else 100.0
    sorted_r = sorted(regions, key=lambda r: abs((r["w"] * r["h"]) - median_area))
    
    keep: List[Dict] = []
    for r in sorted_r:
        rx1, ry1 = r["x"], r["y"]
        rx2, ry2 = rx1 + r["w"], ry1 + r["h"]
        area_r = r["w"] * r["h"]
        
        dominated = False
        for k in keep:
            kx1, ky1 = k["x"], k["y"]
            kx2, ky2 = kx1 + k["w"], ky1 + k["h"]
            area_k = k["w"] * k["h"]
            
            ix = max(0, min(rx2, kx2) - max(rx1, kx1))
            iy = max(0, min(ry2, ky2) - max(ry1, ky1))
            inter = ix * iy
            
            if inter > 0:
                union = area_r + area_k - inter
                iou = inter / union if union > 0 else 0.0
                if iou > overlap_thresh:
                    dominated = True
                    break
        if not dominated:
            keep.append(r)
    return keep


def _merge_nearby_boxes(regions: List[Dict], merge_x: int, merge_y: int,
                        max_w: int, max_h: int) -> List[Dict]:
    """
    Merge bounding boxes that are spatially close (within merge_x px horizontally
    and merge_y px vertically). This groups disconnected strokes of the same
    Tamil character into one bounding box.

    Uses an iterative union approach: expand each box by the merge margin,
    check for overlap with neighbouring expanded boxes, and union them.
    Repeats until no more merges happen.

    Boxes whose merged result exceeds max_w or max_h are NOT merged (they
    would span multiple characters).
    """
    if not regions:
        return regions

    # Work with x1,y1,x2,y2 form for speed
    boxes = [[r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]] for r in regions]

    changed = True
    while changed:
        changed = False
        n = len(boxes)
        merged = [False] * n
        new_boxes = []

        for i in range(n):
            if merged[i]:
                continue
            x1, y1, x2, y2 = boxes[i]
            # Expand by merge margin to check proximity
            ex1, ey1, ex2, ey2 = x1 - merge_x, y1 - merge_y, x2 + merge_x, y2 + merge_y

            for j in range(i + 1, n):
                if merged[j]:
                    continue
                jx1, jy1, jx2, jy2 = boxes[j]

                # Check if j's expanded box overlaps i's expanded box
                if jx1 - merge_x > ex2 or jx2 + merge_x < ex1:
                    continue
                if jy1 - merge_y > ey2 or jy2 + merge_y < ey1:
                    continue

                # Would the merged box be too large?
                mx1 = min(x1, jx1)
                my1 = min(y1, jy1)
                mx2 = max(x2, jx2)
                my2 = max(y2, jy2)
                if (mx2 - mx1) > max_w or (my2 - my1) > max_h:
                    continue

                # Merge j into i
                x1, y1, x2, y2 = mx1, my1, mx2, my2
                ex1 = x1 - merge_x
                ey1 = y1 - merge_y
                ex2 = x2 + merge_x
                ey2 = y2 + merge_y
                merged[j] = True
                changed = True

            new_boxes.append([x1, y1, x2, y2])

        boxes = new_boxes

    return [{"x": b[0], "y": b[1], "w": b[2] - b[0], "h": b[3] - b[1], "line": 0}
            for b in boxes]


# ---------------------------------------------
#  Adaptive contour filter parameters
# ---------------------------------------------

def _filter_params(img_w: int, img_h: int, img_type: str) -> dict:
    char_w_est = max(15, img_w // 30)
    char_h_est = max(15, img_h // 10)

    if img_type in ("clean_document", "photo_of_doc"):
        k_w, k_h = 1, 1   # Printed text doesn't need dilation; it merges close characters
        min_w  = max(5,  img_w // 80)
        min_h  = max(5,  img_h // 40)
        min_area = min_w * min_h
        max_w  = int(img_w * 0.15)
        max_h  = int(img_h * 0.20)
        border = max(4, int(min(img_w, img_h) * 0.005))
        line_gap = max(10, int(char_h_est * 0.4))

    elif img_type == "bw_inscription":
        k_w, k_h = 1, 1   # No dilation to prevent chaining adjacent characters
        min_w  = max(8,  img_w // 60)
        min_h  = max(8,  img_h // 30)
        min_area = min_w * min_h
        max_w  = int(img_w * 0.20)
        max_h  = int(img_h * 0.35)
        border = max(5, int(min(img_w, img_h) * 0.008))
        line_gap = max(10, int(char_h_est * 0.40))

    else:
        # stone_colour and fallbacks
        # NOTE: keep k_w/k_h SMALL -- large dilation merges adjacent characters!
        k_w = 2
        k_h = 2
        min_w  = max(8, img_w // 60)
        min_h  = max(8, img_h // 30)
        min_area = min_w * min_h // 2
        max_w  = int(img_w * 0.30)
        max_h  = int(img_h * 0.50)
        border = max(4, int(min(img_w, img_h) * 0.003))
        line_gap = max(12, int(char_h_est * 0.42))

    return dict(
        k_w=k_w, k_h=k_h,
        min_w=min_w, min_h=min_h, min_area=min_area,
        max_w=max_w, max_h=max_h,
        border=border, line_gap=line_gap,
    )


def _is_stone_crack_or_blank(crop_gray: np.ndarray) -> bool:
    """
    Analyzes a candidate region crop to determine if it is a blank stone crop
    or a vertical stone crack / scratch with no real character strokes.
    """
    if crop_gray is None or crop_gray.size == 0:
        return True
        
    ch, cw = crop_gray.shape[:2]
    if ch < 8 or cw < 8:
        return True

    # 0. Check intensity standard deviation (only reject completely flat featureless crops)
    std_dev = float(np.std(crop_gray))
    if std_dev < 5.0:
        print(f"[SEG] Rejecting blank stone crop with flat contrast: std_dev={std_dev:.2f}")
        return True

    # 1. Binarize using CLAHE + Adaptive
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
    enhanced = clahe.apply(crop_gray)
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
    
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )
    
    # Calculate stroke pixel density ratio
    stroke_pixels = cv2.countNonZero(thresh)
    stroke_density = stroke_pixels / (cw * ch)
    
    # If stroke density is extremely low (< 4.0% of crop area), it's empty stone / crack
    if stroke_density < 0.040:
        print(f"[SEG] Rejecting box with low stroke density (crack/blank stone): density={stroke_density:.3f}")
        return True
        
    # 2. Check maximum horizontal contour width inside crop
    cnts, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    max_contour_w = max((cv2.boundingRect(c)[2] for c in cnts), default=0)
    
    # If the largest contour inside the box is skinnier than 35% of crop width, it's just a vertical crack line!
    if max_contour_w < int(cw * 0.35) and cw < int(ch * 0.75):
        print(f"[SEG] Rejecting box with no horizontal character structure (vertical crack): max_w={max_contour_w}, crop_w={cw}")
        return True
        
    return False


def _recover_unsegmented_gaps(regions: List[Dict], gray: np.ndarray, char_w_est: int, char_h_est: int) -> List[Dict]:
    """
    Scans left margin, inter-box gaps, and right margin.
    If any gap is wider than 50% of median character width, performs multi-strategy
    contour extraction in that gap to recover any missing / unsegmented character!
    """
    if len(regions) < 1:
        return regions

    sorted_regs = sorted(regions, key=lambda r: r["x"])
    recovered = []
    
    img_h, img_w = gray.shape[:2]
    gaps_to_check = []
    
    # 1. Left margin gap (check if character like ம is in left margin)
    first_x = sorted_regs[0]["x"]
    if first_x > max(12, int(char_w_est * 0.25)):
        gaps_to_check.append((0, first_x, sorted_regs[0]["y"], sorted_regs[0]["h"]))
        
    # 2. Inter-box gaps
    for i in range(len(sorted_regs) - 1):
        r1 = sorted_regs[i]
        r2 = sorted_regs[i + 1]
        r1_right = r1["x"] + r1["w"]
        r2_left = r2["x"]
        gap_w = r2_left - r1_right
        if gap_w > max(12, int(char_w_est * 0.35)):
            avg_y = min(r1["y"], r2["y"])
            avg_h = max(r1["y"] + r1["h"], r2["y"] + r2["h"]) - avg_y
            gaps_to_check.append((r1_right, r2_left, avg_y, avg_h))
            
    # 3. Right margin gap (check if character like ர் or ல் is on right margin)
    last_right = sorted_regs[-1]["x"] + sorted_regs[-1]["w"]
    if (img_w - last_right) > max(8, int(char_w_est * 0.20)):
        gaps_to_check.append((last_right, img_w, sorted_regs[-1]["y"], sorted_regs[-1]["h"]))

    # Scan each gap interval for unsegmented character contours
    for gx1_raw, gx2_raw, ref_y, ref_h in gaps_to_check:
        gx1 = max(0, gx1_raw - 2)
        gx2 = min(img_w, gx2_raw + 2)
        gy1 = max(0, ref_y - 4)
        gy2 = min(img_h, ref_y + ref_h + 4)
        
        if (gx2 - gx1) > 6 and (gy2 - gy1) > 6:
            gap_crop = gray[gy1:gy2, gx1:gx2]
            blurred = cv2.GaussianBlur(gap_crop, (3, 3), 0)
            thresh = cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
            )
            
            cnts, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            best_cnt_box = None
            max_cnt_area = 0
            
            for c in cnts:
                cx, cy, cw, ch = cv2.boundingRect(c)
                c_area = cw * ch
                # Require minimum width (25% of char_w_est) to recover margin characters
                if cw >= max(8, int(char_w_est * 0.25)) and ch >= int(char_h_est * 0.35) and c_area > max_cnt_area:
                    asp = cw / ch
                    if 0.25 <= asp <= 3.8:
                        candidate_crop = gap_crop[cy:cy+ch, cx:cx+cw]
                        if not _is_stone_crack_or_blank(candidate_crop):
                            max_cnt_area = c_area
                            best_cnt_box = (gx1 + cx, gy1 + cy, cw, ch)
                        
            if best_cnt_box:
                bx, by, bw, bh = best_cnt_box
                print(f"[SEG] Recovered missing margin/gap character: x={bx}, y={by}, w={bw}, h={bh}")
                recovered.append({"x": bx, "y": by, "w": bw, "h": bh, "line": 0})

    if recovered:
        print(f"[SEG] End-to-End Gap Recovery engine successfully restored {len(recovered)} missed characters.")
        
    return regions + recovered


# ---------------------------------------------
#  Public API
# ---------------------------------------------

def segment_words(image_bgr: np.ndarray, mode: str = "smart", merge_gap_x: int = 4) -> List[Dict]:
    """
    Segment an inscription image into character-level bounding boxes.
    Supports Option 3 Automatic Multi-Strip Assembly for ultra-wide crops.
    """
    if image_bgr is None or image_bgr.size == 0:
        return []
    if len(image_bgr.shape) == 3 and image_bgr.shape[2] == 4:
        image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_BGRA2BGR)
    if len(image_bgr.shape) == 2:
        image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_GRAY2BGR)

    orig_h, orig_w = image_bgr.shape[:2]

    # Option 3: Automatic Multi-Strip Assembly Engine for Wide Inscription Images
    # Triggers whenever aspect ratio > 3.0 or width > 1000px
    if orig_w > 1000 and (orig_w / float(max(1, orig_h))) > 3.0:
        print(f"[SEG-STRIP] Wide image detected ({orig_w}x{orig_h}, aspect={orig_w/max(1,orig_h):.2f}). Running Option 3 Multi-Strip Assembly Engine...")
        strip_width = min(1100, max(600, int(orig_h * 4.2)))
        overlap_w = int(strip_width * 0.40)
        step_w = max(100, strip_width - overlap_w)
        
        all_strip_regions = []
        for x_start in range(0, orig_w, step_w):
            x_end = min(orig_w, x_start + strip_width)
            if (x_end - x_start) < int(orig_h * 1.2) and x_start > 0:
                break
                
            sub_strip = image_bgr[:, x_start:x_end]
            sub_regions = _segment_words_core(sub_strip, mode=mode, merge_gap_x=merge_gap_x)
            
            for r in sub_regions:
                r_copy = dict(r)
                r_copy["x"] += x_start
                all_strip_regions.append(r_copy)
                
            if x_end >= orig_w:
                break
                
        # Remap IDs & Merge overlapping character regions using Spatial IoU NMS
        merged_strip_regions = []
        all_strip_regions.sort(key=lambda r: r["x"])
        for r in all_strip_regions:
            rx, ry, rw, rh = r["x"], r["y"], r["w"], r["h"]
            duplicate = False
            for kept in merged_strip_regions:
                kx, ky, kw, kh = kept["x"], kept["y"], kept["w"], kept["h"]
                ix1, iy1 = max(rx, kx), max(ry, ky)
                ix2, iy2 = min(rx + rw, kx + kw), min(ry + rh, ky + kh)
                if ix1 < ix2 and iy1 < iy2:
                    inter = (ix2 - ix1) * (iy2 - iy1)
                    min_area = min(rw * rh, kw * kh)
                    if inter > 0.50 * min_area:
                        duplicate = True
                        break
            if not duplicate:
                merged_strip_regions.append(r)
                
        # Re-assign sequential IDs
        for idx, r in enumerate(merged_strip_regions):
            r["id"] = idx + 1
            
        print(f"[SEG-STRIP] Stitched {len(merged_strip_regions)} clean character regions across multi-strip assembly.")
        return merged_strip_regions
    else:
        return _segment_words_core(image_bgr, mode=mode, merge_gap_x=merge_gap_x)


def _segment_words_core(image_bgr: np.ndarray, mode: str = "smart", merge_gap_x: int = 4) -> List[Dict]:
    orig      = image_bgr
    orig_h, orig_w = orig.shape[:2]
    print(f"[SEG] Input: {orig_w}×{orig_h}")

    # -- STEP 1: Uniform High-Resolution Height Scaling -----------------------
    # Guarantee working image line height is ALWAYS >= 450px so characters are
    # crisp, high-resolution (~220px tall), with clear separation gaps between letters!
    MIN_WORK_H = 450
    if orig_h < MIN_WORK_H:
        scale_up = MIN_WORK_H / float(max(1, orig_h))
        work_h = MIN_WORK_H
        work_w = int(orig_w * scale_up)
        if work_w > 2800:
            scale_down = 2800.0 / work_w
            work_w = 2800
            work_h = int(work_h * scale_down)
        work = cv2.resize(orig, (work_w, work_h), interpolation=cv2.INTER_CUBIC)
    else:
        MAX_W = 2000
        work = _resize_to_max(orig, MAX_W)
        work_h, work_w = work.shape[:2]

    sx = orig_w / float(work_w)
    sy = orig_h / float(work_h)
    _save_debug("01_resized.jpg", work)

    # -- STEP 2: Grayscale -----------------------------------------------------
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    _save_debug("02_gray.jpg", gray)

    # -- STEP 3: Image type detection ------------------------------------------
    img_type = _detect_image_type(gray)
    print(f"[SEG] Image type: {img_type}")

    params = _filter_params(work_w, work_h, img_type)
    print(f"[SEG] Filter params: {params}")

    # =========================================================================
    # SMART HYBRID MODE (YOLO + OpenCV Precision)
    # =========================================================================
    if mode == "smart" and _YOLO_MODEL is not None:
        print("[SEG] Running SMART HYBRID mode (YOLO Tiled Inference)")
        
        h, w = image_bgr.shape[:2]
        yolo_boxes = []
        yolo_scores = []
        
        TILE_SIZE = 1280
        # For wide horizontal crops, use dense 75% overlap (OVERLAP = 960px, STEP = 320px)
        # so every single character appears near the center of at least 3 separate tiles!
        if w > 1600 or (w / max(1, h)) > 4.0:
            OVERLAP = 960
            print(f"[SEG] Wide crop detected ({w}x{h}). Using Dense 75% Sliding Window (OVERLAP=960px, STEP=320px)...")
        else:
            OVERLAP = 640

        # Sliced Inference (just like training data!)
        print(f"[SEG] Slicing {w}x{h} image into {TILE_SIZE}x{TILE_SIZE} tiles with {OVERLAP}px overlap...")
        for y in range(0, max(1, h), max(1, TILE_SIZE - OVERLAP)):
            for x in range(0, max(1, w), max(1, TILE_SIZE - OVERLAP)):
                y2 = min(y + TILE_SIZE, h)
                x2 = min(x + TILE_SIZE, w)
                y1 = max(0, y2 - TILE_SIZE)
                x1 = max(0, x2 - TILE_SIZE)
                
                if y1 >= y2 or x1 >= x2:
                    continue
                    
                tile = image_bgr[y1:y2, x1:x2]
                results = _YOLO_MODEL(tile, conf=0.04, iou=0.55, augment=True, verbose=False)
                boxes = results[0].boxes.xyxy.cpu().numpy()
                confs = results[0].boxes.conf.cpu().numpy()
                
                for i in range(len(boxes)):
                    box = boxes[i]
                    bx = int(box[0] + x1)
                    by = int(box[1] + y1)
                    bw = int(box[2] - box[0])
                    bh = int(box[3] - box[1])
                    yolo_boxes.append([bx, by, bw, bh])
                    yolo_scores.append(float(confs[i]))
                
                if x2 >= w: break
            if y2 >= h: break

        # Apply NMS to remove duplicates across overlapping slices
        if len(yolo_boxes) > 0:
            indices = cv2.dnn.NMSBoxes(yolo_boxes, yolo_scores, score_threshold=0.04, nms_threshold=0.55)
            if len(indices) > 0:
                indices = indices.flatten()
                
                # ── Apply Containment / High Overlap Filter (prioritizing high-confidence boxes) ──
                boxes_with_scores = [(yolo_boxes[i], yolo_scores[i]) for i in indices]
                boxes_with_scores.sort(key=lambda x: x[1], reverse=True)
                
                final_yolo_boxes = []
                for box, score in boxes_with_scores:
                    bx, by, bw, bh = box
                    x1_a, y1_a = bx, by
                    x2_a, y2_a = bx + bw, by + bh
                    area_a = bw * bh
                    
                    is_contained = False
                    for kept_box in final_yolo_boxes:
                        x1_b, y1_b, x2_b, y2_b = kept_box
                        area_b = (x2_b - x1_b) * (y2_b - y1_b)
                        
                        ix1 = max(x1_a, x1_b)
                        iy1 = max(y1_a, y1_b)
                        ix2 = min(x2_a, x2_b)
                        iy2 = min(y2_a, y2_b)
                        
                        if ix1 < ix2 and iy1 < iy2:
                            inter_area = (ix2 - ix1) * (iy2 - iy1)
                            # If intersection is >88% of the smaller box, they are essentially the same region
                            if inter_area > 0.88 * min(area_a, area_b):
                                is_contained = True
                                break
                                
                    if not is_contained:
                        final_yolo_boxes.append([x1_a, y1_a, x2_a, y2_a])
                        
                yolo_boxes = final_yolo_boxes
            else:
                yolo_boxes = []

        # If YOLO found nothing, fallback to classic
        if len(yolo_boxes) == 0:
            print("[SEG] YOLO found no boxes, falling back to Classic mode.")
        else:
            print(f"[SEG] Found {len(yolo_boxes)} total raw YOLO boxes. Mapping to work resolution.")
            regions = []
            for box in yolo_boxes:
                # YOLO boxes are in original resolution. We need them in work resolution.
                x1_orig, y1_orig, x2_orig, y2_orig = [int(v) for v in box]
                x1_work = int(x1_orig / sx)
                y1_work = int(y1_orig / sy)
                x2_work = int(x2_orig / sx)
                y2_work = int(y2_orig / sy)
                
                w_work = x2_work - x1_work
                h_work = y2_work - y1_work
                
                # Reject impossibly small boxes (like noise specks)
                if w_work < 8 or h_work < 8:
                    continue
                    
                # Reject extreme aspect ratios (cracks and scratches in the stone)
                aspect_ratio = w_work / h_work
                if aspect_ratio > 4.5 or aspect_ratio < 0.35:
                    print(f"[SEG] Rejecting YOLO box with extreme aspect ratio (crack): w={w_work}, h={h_work}, ar={aspect_ratio:.2f}")
                    continue
                
                # YOLO already perfectly bounds the whole character
                regions.append({"x": x1_work, "y": y1_work, "w": w_work, "h": h_work, "line": 0})
                
            if len(regions) > 0:
                widths = sorted([r["w"] for r in regions])
                heights = sorted([r["h"] for r in regions])
                char_w_est = widths[len(widths) // 2]
                char_h_est = heights[len(heights) // 2]
                
                # Filter out partial characters from adjacent lines (caught at top/bottom edges of crop)
                filtered_regions = []
                top_edge_thresh = max(30, int(work_h * 0.12))
                bottom_edge_thresh = work_h - top_edge_thresh
                left_edge_thresh = max(25, int(work_w * 0.05))
                right_edge_thresh = work_w - left_edge_thresh

                for r in regions:
                    # A box is a partial cut-off stroke if it starts near the top or ends near the bottom AND is abnormally short
                    is_top = r["y"] <= (top_edge_thresh // 2)
                    is_bottom = (r["y"] + r["h"]) >= (work_h - (top_edge_thresh // 2))
                    
                    if (is_top or is_bottom) and r["h"] < (char_h_est * 0.30):
                        print(f"[SEG] Rejecting partial top/bottom edge character: y={r['y']}, h={r['h']} (median_h={char_h_est})")
                        continue

                    # Touches the extreme left or right boundary of the image frame
                    is_left = r["x"] <= 2
                    is_right = (r["x"] + r["w"]) >= (work_w - 2)
                    
                    # Only reject if it is an impossibly thin partial sliver (< 10% of median width)
                    if (is_left or is_right) and r["w"] < (char_w_est * 0.10):
                        print(f"[SEG] Rejecting partial left/right edge sliver: x={r['x']}, w={r['w']} (median_w={char_w_est})")
                        continue

                    # Stone Crack / Fissure Suppressor:
                    # Only reject extremely thin vertical cracks (w < 20% of median character width AND aspect ratio < 0.15)
                    asp = r["w"] / r["h"] if r["h"] > 0 else 1.0
                    if asp < 0.15 and r["w"] < (char_w_est * 0.20):
                        print(f"[SEG] Rejecting vertical stone crack: w={r['w']}, h={r['h']}, ar={asp:.2f} (median_w={char_w_est})")
                        continue

                    # Physical Stroke & Contour Density Verification:
                    # Rejects blank stone crops, cracks, and scratches with no horizontal character structure
                    crop_gray = gray[r["y"]:r["y"]+r["h"], r["x"]:r["x"]+r["w"]]
                    if _is_stone_crack_or_blank(crop_gray):
                        print(f"[SEG] Rejecting crack/blank box at x={r['x']}, y={r['y']}")
                        continue

                    # Reject top margin hallucination boxes near extreme top edge (y <= 5px or y <= 5% height)
                    is_top_margin = r["y"] <= max(6, int(work_h * 0.05))
                    if is_top_margin and r["h"] < (char_h_est * 0.70):
                        print(f"[SEG] Rejecting top margin hallucination box: y={r['y']}, h={r['h']} (median_h={char_h_est})")
                        continue

                    # Absolute noise check
                    if r["h"] < 12 or r["w"] < 8:
                        print(f"[SEG] Rejecting tiny noise speck: w={r['w']}, h={r['h']}")
                        continue
                        
                    filtered_regions.append(r)
                regions = filtered_regions
            else:
                char_w_est = max(15, work_w // 30)
                char_h_est = max(15, work_h // 10)
            
            pass



    border   = params["border"]
    min_w    = params["min_w"]
    min_h    = params["min_h"]
    min_area = params["min_area"]
    max_w    = params["max_w"]
    max_h    = params["max_h"]

    # =========================================================================
    # CLASSIC MODE (OpenCV Only) - OR FALLBACK
    # =========================================================================
    if mode != "smart" or _YOLO_MODEL is None or len(yolo_boxes) == 0:
        print("[SEG] Running CLASSIC mode (OpenCV)")
        # -- STEP 4: Best binary mask via multi-strategy scoring -------------------
        binary = _best_binary(gray, img_type, work_w, work_h)
        _save_debug("04_binary.jpg", binary)

        # -- STEP 6: Strip border region -------------------------------------------
        binary[:border, :]  = 0
        binary[-border:, :] = 0
        binary[:, :border]  = 0
        binary[:, -border:] = 0


        def _extract_regions(mask: np.ndarray) -> List[Dict]:
            """Find contours from mask and apply size/aspect filters."""
            cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            result = []
            for cnt in cnts:
                x, y, w, h = cv2.boundingRect(cnt)
                area = w * h
                if x < border or y < border:
                    continue
                if (x + w) > (work_w - border):
                    continue
                if (y + h) > (work_h - border):
                    continue
                if w > max_w or h > max_h:
                    continue
                if w < min_w or h < min_h:
                    continue
                if area < min_area:
                    continue
                asp = w / h if h > 0 else 999
                if asp > 8.0 or asp < 0.12:
                    continue
                result.append({"x": x, "y": y, "w": w, "h": h, "line": 0})
            return result

        # -- STEP 7: Try raw binary first, then with dilation, keep the better one --
        regions_raw = _extract_regions(binary)
        print(f"[SEG] Raw binary -> {len(regions_raw)} regions")

        if params["k_w"] > 1 or params["k_h"] > 1:
            k_word  = cv2.getStructuringElement(cv2.MORPH_RECT, (params["k_w"], params["k_h"]))
            dilated = cv2.dilate(binary, k_word, iterations=1)
            _save_debug("05_dilated.jpg", dilated)
            regions_dil = _extract_regions(dilated)
            print(f"[SEG] Dilated ({params['k_w']}x{params['k_h']}) -> {len(regions_dil)} regions")

            # Pick whichever gives more surviving regions
            if len(regions_raw) >= len(regions_dil):
                regions = regions_raw
                print("[SEG] Using raw binary (more regions)")
            else:
                regions = regions_dil
                print("[SEG] Using dilated binary (more regions)")
        else:
            regions = regions_raw
            _save_debug("05_dilated.jpg", binary)
            print("[SEG] Skipping dilation (k_w=1, k_h=1)")


    print(f"[SEG] After size filter / generation: {len(regions)}")

    # -- STEP 8: Remove noise fragments (median-area filter) ----------------------
    # Proximity merge is INTENTIONALLY disabled for all types:
    #   - Stone images: chaining merges adjacent characters even at 3px margin
    #   - B&W images: dilation (2x1) already connects strokes within a character;
    #     proximity merge would additionally merge adjacent characters that touch.
    # Instead: remove blobs much smaller than the median character area (noise/dust).

    char_w_est = max(15, work_w // 30)
    char_h_est = max(15, work_h // 10)

    if mode != "smart" and regions:
        areas = sorted([r["w"] * r["h"] for r in regions])
        median_area = areas[len(areas) // 2]
        # Keep blobs >= 18% of median area (removes isolated dust/cracks/serifs)
        min_keep_area = max(params["min_area"], int(median_area * 0.18))
        before = len(regions)
        regions = [r for r in regions if r["w"] * r["h"] >= min_keep_area]
        print(f"[SEG] Noise filter (min_area={min_keep_area}, median={median_area}): {before} -> {len(regions)}")


    # -- STEP 9: Overlap removal -----------------------------------------------
    thresh = 0.50
    regions = _remove_overlaps(regions, overlap_thresh=thresh)
    print(f"[SEG] After overlap removal: {len(regions)}")

    # ── STEP 9.5: Final Physical Stroke & Crack Elimination Pass ─────────────
    # Run _is_stone_crack_or_blank on all regions to guarantee no crack/blank box escapes
    final_regions = []
    for r in regions:
        crop_gray = gray[r["y"]:r["y"]+r["h"], r["x"]:r["x"]+r["w"]]
        if not _is_stone_crack_or_blank(crop_gray):
            final_regions.append(r)
        else:
            print(f"[SEG] Final Pass: Successfully eliminated stone crack/blank box at x={r['x']}, y={r['y']}")
    if final_regions:
        regions = final_regions

    if not regions:
        print("[SEG] WARNING: No regions detected. Returning empty list.")
        return []

    # -- STEP 10: Cluster into lines -------------------------------------------
    # For Tamil script, characters can have tall ascenders or long descenders.
    # We sort by center Y and use a large line_gap tolerance (90% of median height)
    # to keep slightly staggered characters on the same line.
    for r in regions:
        r["yc"] = r["y"] + r["h"] / 2

    regions.sort(key=lambda r: r["yc"])

    # Use median box height to compute a robust line gap threshold
    heights = sorted([r["h"] for r in regions])
    median_h = heights[len(heights) // 2] if heights else char_h_est
    line_gap = max(params["line_gap"], int(median_h * 0.9)) # Increased to 0.9 for robustness
    if len(regions) < 10:
        line_gap = max(line_gap, work_h // 8)
    print(f"[SEG] Line gap: {line_gap}px  (median_h={median_h}px)")

    line_num = 1
    cur_yc = regions[0]["yc"]
    for r in regions:
        yc = r["yc"]
        if yc - cur_yc > line_gap:
            line_num += 1
            cur_yc = yc
        r["line"] = line_num

    print(f"[SEG] Lines detected: {line_num}")

    # -- STEP 10.5: Filter out ghost lines containing only partial stroke fragments --
    line_groups = {}
    for r in regions:
        l = r["line"]
        if l not in line_groups:
            line_groups[l] = []
        line_groups[l].append(r)

    max_line_boxes = max((len(boxes) for boxes in line_groups.values()), default=1)
    surviving_regions = []
    for l, boxes in line_groups.items():
        avg_h = sum(b["h"] for b in boxes) / len(boxes)
        if len(boxes) <= 3 and len(boxes) < (max_line_boxes * 0.4) and avg_h < (median_h * 0.60):
            print(f"[SEG] Suppressing ghost line {l} with {len(boxes)} boxes and avg_h={avg_h:.1f} (median_h={median_h})")
            continue
        surviving_regions.extend(boxes)

    if surviving_regions:
        regions = surviving_regions

    # -- STEP 11: Sort by line then x + Merge adjacent touching compound glyphs ──
    regions.sort(key=lambda r: (r["line"], r["x"]))
    
    # Merge adjacent touching or overlapping boxes on the same line (e.g., kombu + consonant + aravu = single compound letter)
    merged_regions = []
    i = 0
    while i < len(regions):
        curr = regions[i]
        while i < len(regions) - 1:
            nxt = regions[i + 1]
            if curr.get("line", 1) == nxt.get("line", 1):
                curr_right = curr["x"] + curr["w"]
                nxt_left = nxt["x"]
                # If adjacent boxes touch or overlap (gap <= merge_gap_x)
                if curr_right >= (nxt_left - max(4, merge_gap_x)):
                    mx1 = min(curr["x"], nxt["x"])
                    my1 = min(curr["y"], nxt["y"])
                    mx2 = max(curr["x"] + curr["w"], nxt["x"] + nxt["w"])
                    my2 = max(curr["y"] + curr["h"], nxt["y"] + nxt["h"])
                    merged_w = mx2 - mx1
                    merged_h = my2 - my1
                    # Merge if resulting box is within valid compound Tamil character width
                    if merged_w <= int(char_w_est * 2.2):
                        curr = {"x": mx1, "y": my1, "w": merged_w, "h": merged_h, "line": curr.get("line", 1)}
                        i += 1
                        print(f"[SEG] Merged adjacent compound Tamil glyphs into single box: w={merged_w}")
                        continue
            break
        merged_regions.append(curr)
        i += 1

    regions = merged_regions

    for i, r in enumerate(regions):
        r["_id"] = i + 1

    # -- STEP 12: Build output + debug visualisation ---------------------------
    LINE_COLORS = [
        (0,   0,   255), (0,   200,   0), (255,   0,   0),
        (0,   200, 200), (200,   0, 200), (0,   165, 255),
        (128,   0, 128), (0,   128, 128), (255, 165,   0),
        (0,   255, 165),
    ]

    output: List[Dict] = []
    debug_vis = orig.copy()

    for r in regions:
        rx, ry, rw, rh = r["x"], r["y"], r["w"], r["h"]
        rid   = r["_id"]
        color = LINE_COLORS[(r["line"] - 1) % len(LINE_COLORS)]

        ox = int(rx * sx)
        oy = int(ry * sy)
        ow = int(rw * sx)
        oh = int(rh * sy)

        x1 = max(0, ox)
        y1 = max(0, oy)
        x2 = min(orig_w, ox + ow)
        y2 = min(orig_h, oy + oh)
        crop = orig[y1:y2, x1:x2]

        output.append({
            "id":   rid,
            "x":    ox,
            "y":    oy,
            "w":    ow,
            "h":    oh,
            "line": r["line"],
            "crop": crop,
        })

        cv2.rectangle(debug_vis, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            debug_vis, str(rid),
            (x1, max(y1 - 3, 10)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA,
        )

    _save_debug("06_result.jpg", debug_vis)
    print(f"[SEG] Final regions: {len(output)}")
    return output
