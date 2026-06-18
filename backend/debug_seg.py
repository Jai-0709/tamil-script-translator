"""
debug_seg.py — Step-by-step segmentation pipeline debugger
Saves one image per pipeline stage so you can inspect each transformation.

Usage:
    python "E:\\TAMIL SCRIPT VERSION 2\\backend\\debug_seg.py"

Edit IMAGE_PATH below to point to your test inscription image.
"""

from pathlib import Path
import sys
import cv2
import numpy as np

# ─────────────────────────────────────────────
#  CONFIGURATION — edit these two lines
# ─────────────────────────────────────────────
IMAGE_PATH = r"E:\TAMIL SCRIPT VERSION 2\testing 1.jpg"   # ← your image
DEBUG_DIR  = Path(r"E:\TAMIL SCRIPT VERSION 2\debug")

# Segmentation parameters (must match segmentation.py)
MAX_WIDTH    = 1200
CLAHE_CLIP   = 3.0
CLAHE_GRID   = (8, 8)
GAUSS_K      = (21, 21)
OPEN_K       = (3, 3)
OPEN_ITER    = 2
DILATE_K     = (20, 5)
DILATE_ITER  = 1
MIN_AREA     = 600
MAX_AREA_PCT = 0.06        # 6% of total image area
MIN_W        = 20
MAX_W_FRAC   = 0.20
MIN_H        = 15
MAX_H_FRAC   = 0.15
LINE_THRESH  = 20

# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────
def save(name: str, img: np.ndarray):
    """Save a debug stage image and print confirmation."""
    out = DEBUG_DIR / name
    cv2.imwrite(str(out), img)
    h, w = img.shape[:2]
    print(f"  Saved: {name:35s}  ({w}x{h})")


def to_bgr(gray: np.ndarray) -> np.ndarray:
    """Convert grayscale to BGR for coloured overlay saves."""
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def draw_boxes(base_bgr: np.ndarray, contours, color=(0, 255, 0),
               thickness=1, labels=None) -> np.ndarray:
    """Draw bounding rects of contours onto a copy of base_bgr."""
    out = base_bgr.copy()
    for i, cnt in enumerate(contours):
        x, y, w, h = cv2.boundingRect(cnt)
        cv2.rectangle(out, (x, y), (x + w, y + h), color, thickness)
        if labels:
            lbl = str(labels[i]) if i < len(labels) else ""
            cv2.putText(out, lbl, (x, max(y - 3, 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA)
    return out


def sep(title: str):
    print(f"\n{'-'*55}")
    print(f"  {title}")
    print(f"{'-'*55}")

# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    # ── 0. Prepare ───────────────────────────────────────────────────────
    img_path = Path(IMAGE_PATH)
    if not img_path.exists():
        print(f"[ERROR] Image not found: {img_path}")
        print("        Edit IMAGE_PATH at the top of debug_seg.py")
        sys.exit(1)

    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n{'='*55}")
    print(f"  Segmentation Debug Pipeline")
    print(f"  Image : {img_path.name}")
    print(f"  Output: {DEBUG_DIR}")
    print(f"{'='*55}")

    # ── Stage 1: Original ────────────────────────────────────────────────
    sep("Stage 1 - Load original image")
    original = cv2.imread(str(img_path))
    if original is None:
        print(f"[ERROR] OpenCV could not decode image: {img_path}")
        sys.exit(1)
    orig_h, orig_w = original.shape[:2]
    print(f"  Original size: {orig_w}x{orig_h}  ({img_path.stat().st_size/1024/1024:.2f} MB)")
    save("01_original.jpg", original)

    # ── Stage 2: Resize ──────────────────────────────────────────────────
    sep("Stage 2 - Resize (max width 1200px)")
    if orig_w > MAX_WIDTH:
        scale = MAX_WIDTH / orig_w
        work  = cv2.resize(original, (MAX_WIDTH, int(orig_h * scale)), interpolation=cv2.INTER_AREA)
        print(f"  Resized from {orig_w}x{orig_h} -> {work.shape[1]}x{work.shape[0]}")
    else:
        work = original.copy()
        print(f"  Image width <= {MAX_WIDTH}px - no resize needed.")
    work_h, work_w = work.shape[:2]
    # (save original-size copy as "working image" snapshot)
    save("01_original.jpg", original)    # already saved above

    # ── Stage 2: Convert to grayscale and invert ─────────────────────────
    sep("Stage 2 - Grayscale & Invert")
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    save("01_gray.jpg", gray)
    
    inverted = cv2.bitwise_not(gray)
    save("02_inverted.jpg", inverted)

    # ── Stage 3: Strong blur and CLAHE ──────────────────────────────────
    sep("Stage 3 - Strong Blur (21,21) and CLAHE")
    blurred = cv2.GaussianBlur(inverted, GAUSS_K, 0)
    save("03_blurred.jpg", blurred)
    
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP, tileGridSize=CLAHE_GRID)
    enhanced = clahe.apply(blurred)
    save("04_enhanced.jpg", enhanced)

    # ── Stage 4 & 5: Threshold and Foreground Check ─────────────────────
    sep("Stage 4 & 5 - Threshold (127, then check fg%)")
    _, binary = cv2.threshold(enhanced, 127, 255, cv2.THRESH_BINARY)
    fg_pct = cv2.countNonZero(binary) / binary.size
    print(f"  Foreground after threshold 127: {fg_pct:.1%}")
    
    if fg_pct > 0.4:
        _, binary = cv2.threshold(enhanced, 150, 255, cv2.THRESH_BINARY)
        fg_pct = cv2.countNonZero(binary) / binary.size
        print(f"  Foreground after threshold 150: {fg_pct:.1%}")
    
    if fg_pct > 0.6:
        _, binary = cv2.threshold(enhanced, 170, 255, cv2.THRESH_BINARY)
        fg_pct = cv2.countNonZero(binary) / binary.size
        print(f"  Foreground after threshold 170: {fg_pct:.1%}")
        
    save("05_binary.jpg", binary)

    # ── Stage 6: Zero out 20px border ───────────────────────────────────
    sep("Stage 6 - Zero out 20px border")
    binary[:20, :] = 0
    binary[-20:, :] = 0
    binary[:, :20] = 0
    binary[:, -20:] = 0
    print("  Done.")

    # ── Stage 7: Morphological opening ──────────────────────────────────
    sep("Stage 7 - Opening (Ellipse 3x3, iter=2)")
    k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, OPEN_K)
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k_open, iterations=OPEN_ITER)
    save("06_opened.jpg", opened)
    print("  Done.")

    # ── Stage 8: Dilation ───────────────────────────────────────────────
    sep("Stage 8 - Dilation")
    k_word = cv2.getStructuringElement(cv2.MORPH_RECT, (8, 3))
    dilated = cv2.dilate(opened, k_word, iterations=1)
    save("07_dilated.jpg", dilated)
    print("  Done.")

    # ── Stage 9: Find contours and filter ───────────────────────────────
    sep("Stage 9 - Find contours and filter")
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    print(f"  [SEG] After dilation — total contours: {len(contours)}")
    print(f"  [SEG] Total raw contours: {len(contours)}")
    for i, cnt in enumerate(contours[:20]):
        x,y,w,h = cv2.boundingRect(cnt)
        area = w*h
        print(f"  Contour {i}: x={x} y={y} w={w} h={h} area={area}")
    
    img_h, img_w = work.shape[:2]
    img_area = img_h * img_w
    
    def filter_contours(cnts, min_a=100, min_w=8):
        res = []
        for cnt in cnts:
            x, y, w, h = cv2.boundingRect(cnt)
            area = w * h
            reject_reason = None
            if area < min_a:
                reject_reason = f"area {area} < {min_a}"
            elif area > 0.50 * img_area:
                reject_reason = f"area {area} > max (50%)"
            elif w < min_w:
                reject_reason = f"width {w} < {min_w}"
            elif w > 0.80 * img_w:
                reject_reason = f"width {w} > max (80%)"
            elif h < 8:
                reject_reason = f"height {h} < 8"
            elif h > 0.80 * img_h:
                reject_reason = f"height {h} > max (80%)"
                
            if reject_reason:
                print(f"  REJECTED: {reject_reason} at x={x} y={y}")
            else:
                print(f"  ACCEPTED: x={x} y={y} w={w} h={h}")
                res.append(cnt)
        return res

    filtered = filter_contours(contours, min_a=100, min_w=8)
    
    # ── Stage 10: Adjust if too many ────────────────────────────────────
    if len(filtered) > 200:
        filtered = [cnt for cnt in filtered if cv2.boundingRect(cnt)[2]*cv2.boundingRect(cnt)[3] > 1000]
        
    # ── Stage 11: Adjust if too few ─────────────────────────────────────
    if len(filtered) < 5:
        print("  [SEG] WARNING: very few regions, relaxing filters")

    print(f"  [SEG] After filtering — regions: {len(filtered)}")

    # Draw filtered contours on original colour image
    # Note: original is high res, we must map boxes to it for 08_result
    sx_orig = orig_w / work_w
    sy_orig = orig_h / work_h
    filt_img = original.copy()
    
    for i, cnt in enumerate(filtered):
        x, y, w, h = cv2.boundingRect(cnt)
        ox = int(x * sx_orig)
        oy = int(y * sy_orig)
        ow = int(w * sx_orig)
        oh = int(h * sy_orig)
        
        cv2.rectangle(filt_img, (ox, oy), (ox+ow, oy+oh), (0, 0, 255), 2)
        cv2.putText(filt_img, str(i+1), (ox, max(oy - 3, 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)

    save("08_result.jpg", filt_img)
    print(f"  [SEG] Final regions returned: {len(filtered)}")

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'='*55}")
    print(f"  SUMMARY")
    print(f"{'='*55}")
    print(f"  Contours found   : {len(contours)}")
    print(f"  Regions (filtered): {len(filtered)}")
    print(f"  Debug images saved to: {DEBUG_DIR}")
    print()


if __name__ == "__main__":
    main()
