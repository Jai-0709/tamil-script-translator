"""
test_pipeline.py — End-to-end pipeline test for Ancient Tamil Inscription Translator
Usage:  python test_pipeline.py --image "path/to/test.jpg"
        python test_pipeline.py --image "path/to/test.jpg" --output my_result.jpg
"""

import sys
import argparse
from pathlib import Path

import cv2
import numpy as np

# ── ensure backend/ is on sys.path ──────────────────────────────────────────
ROOT_DIR    = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from segmentation import segment_words      # noqa: E402
import classifier                           # noqa: E402


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────
def word_color_bgr(word_id: int):
    """Return a unique BGR color for a given word id."""
    hue  = (word_id * 47) % 180           # OpenCV hue is 0-179
    hsv  = np.array([[[hue, 200, 220]]], dtype=np.uint8)
    bgr  = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)[0][0]
    return (int(bgr[0]), int(bgr[1]), int(bgr[2]))


def print_table(rows):
    header = f"{'ID':>4}  {'x':>5}  {'y':>5}  {'w':>5}  {'h':>5}  {'Modern Tamil':<14}  {'Confidence':>10}"
    sep    = "─" * len(header)
    print("\n" + sep)
    print(header)
    print(sep)
    for row in rows:
        wid, x, y, w, h, tamil, conf = row
        print(f"{wid:>4}  {x:>5}  {y:>5}  {w:>5}  {h:>5}  {tamil:<14}  {conf:>9.1f}%")
    print(sep)


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Ancient Tamil Inscription — Pipeline Test")
    parser.add_argument("--image",  required=True, help="Path to the inscription image")
    parser.add_argument("--output", default="test_output.jpg", help="Output image path (default: test_output.jpg)")
    args = parser.parse_args()

    img_path    = Path(args.image)
    output_path = Path(args.output)

    # ── 1. Load image ────────────────────────────────────────────────────
    if not img_path.exists():
        print(f"[ERROR] Image not found: {img_path}")
        sys.exit(1)

    image = cv2.imread(str(img_path))
    if image is None:
        print(f"[ERROR] Could not read image: {img_path}")
        sys.exit(1)

    img_h, img_w = image.shape[:2]
    print(f"\n[INFO] Image loaded  : {img_path.name}  ({img_w}×{img_h})")

    # ── 2. Segmentation ──────────────────────────────────────────────────
    print("[INFO] Running segmentation ...")
    regions = segment_words(image)
    print(f"[INFO] Words detected: {len(regions)}")

    if not regions:
        print("[WARN] No words detected. Try a higher-contrast image.")
        sys.exit(0)

    for r in regions:
        print(f"       Line {r['line']:>2}  Box #{r['id']:>3}  "
              f"x={r['x']} y={r['y']} w={r['w']} h={r['h']}")

    # ── 3. Classification ────────────────────────────────────────────────
    print("\n[INFO] Running classifier ...")
    try:
        crops   = [r["crop"] for r in regions]
        results = classifier.classify_batch(crops)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    # ── 4. Print table ────────────────────────────────────────────────────
    table_rows = []
    for region, res in zip(regions, results):
        table_rows.append((
            region["id"],
            region["x"], region["y"],
            region["w"], region["h"],
            res["modern_tamil"] or res["class_id"],
            res["confidence"] * 100,
        ))

    print_table(table_rows)

    # ── 5. Full sentence ──────────────────────────────────────────────────
    line_map: dict[int, list[str]] = {}
    for region, res in zip(regions, results):
        line_map.setdefault(region["line"], []).append(res["modern_tamil"] or res["class_id"])

    sentence = "  ".join(
        "".join(line_map[ln]) for ln in sorted(line_map)
    )
    print(f"\n  Full sentence : {sentence}")
    print(f"  Word count    : {len(regions)}")
    print(f"  Line count    : {len(line_map)}")

    # ── 6. Save annotated output image ───────────────────────────────────
    output_img = image.copy()
    for region, res in zip(regions, results):
        x, y, w, h  = region["x"], region["y"], region["w"], region["h"]
        color        = word_color_bgr(region["id"])
        conf_pct     = res["confidence"] * 100
        label        = f"#{region['id']} {res['modern_tamil'] or res['class_id']} {conf_pct:.0f}%"

        # Semi-transparent fill
        overlay = output_img.copy()
        cv2.rectangle(overlay, (x, y), (x + w, y + h), color, -1)
        cv2.addWeighted(overlay, 0.2, output_img, 0.8, 0, output_img)

        # Border
        cv2.rectangle(output_img, (x, y), (x + w, y + h), color, 2)

        # Label background
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
        cv2.rectangle(output_img, (x, y - lh - 6), (x + lw + 4, y), color, -1)

        # Label text
        cv2.putText(
            output_img, label,
            (x + 2, y - 4),
            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA
        )

    cv2.imwrite(str(output_path), output_img)
    print(f"\n[INFO] Annotated image saved → {output_path.resolve()}\n")


if __name__ == "__main__":
    main()
