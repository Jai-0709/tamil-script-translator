"""
check_dataset.py — Dataset health checker for Ancient Tamil Inscription Translator
Usage: python check_dataset.py
"""

from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "TAMIL SCRIPT DATASET"

DATASETS = {
    "images_categorised": DATA_DIR / "images_categorised",
    "augmented_images"  : DATA_DIR / "augmented_images",
    "Modern characters" : DATA_DIR / "Modern characters",
}

IMG_EXTS       = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
MIN_IMAGES     = 20
SEP            = "─" * 60


def scan_folder(folder: Path) -> tuple[dict, list]:
    """
    Scan a dataset root folder (containing numbered class subdirs).
    Returns:
        class_counts : dict  {class_name: count}
        corrupt      : list  of Path objects that failed to open
    """
    class_counts = {}
    corrupt      = []

    if not folder.exists():
        print(f"  [MISSING] {folder}")
        return class_counts, corrupt

    class_dirs = sorted(
        [d for d in folder.iterdir() if d.is_dir()],
        key=lambda d: (int(d.name) if d.name.isdigit() else float("inf"))
    )

    for cls_dir in class_dirs:
        images = [p for p in cls_dir.iterdir() if p.is_file() and p.suffix.lower() in IMG_EXTS]
        valid  = 0
        for img_path in images:
            try:
                with Image.open(img_path) as im:
                    im.verify()
                valid += 1
            except Exception:
                corrupt.append(img_path)
        class_counts[cls_dir.name] = valid

    return class_counts, corrupt


def print_class_table(class_counts: dict, warn_threshold: int):
    if not class_counts:
        print("  (no classes found)")
        return

    col_cls  = max(len(k) for k in class_counts) + 2
    col_cnt  = 8
    header   = f"  {'Class':<{col_cls}} {'Count':>{col_cnt}}  Status"
    print(header)
    print("  " + "·" * (col_cls + col_cnt + 10))

    for cls in sorted(class_counts.keys(), key=lambda x: (int(x) if x.isdigit() else float("inf"))):
        count = class_counts[cls]
        if count == 0:
            status = "❌ EMPTY"
        elif count < warn_threshold:
            status = f"⚠  LOW (<{warn_threshold})"
        else:
            status = "✓"
        print(f"  {cls:<{col_cls}} {count:>{col_cnt}}  {status}")


def main():
    print(f"\n{'═'*60}")
    print("  Ancient Tamil Dataset Health Check")
    print(f"{'═'*60}")
    print(f"  Root: {DATA_DIR}\n")

    grand_total   = 0
    grand_corrupt = []

    for ds_name, ds_path in DATASETS.items():
        print(f"{SEP}")
        print(f"  📂 {ds_name}")
        print(f"     {ds_path}")
        print(SEP)

        counts, corrupt = scan_folder(ds_path)

        if counts:
            print_class_table(counts, MIN_IMAGES)
            ds_total = sum(counts.values())
            print(f"\n  Total classes : {len(counts)}")
            print(f"  Total images  : {ds_total}")
        else:
            ds_total = 0

        if corrupt:
            print(f"\n  ⚠  {len(corrupt)} corrupt / unreadable image(s):")
            for p in corrupt:
                print(f"       {p}")
        else:
            print(f"  ✓  No corrupt images found.")

        # Low-image-count warnings
        low_classes = [cls for cls, cnt in counts.items() if 0 < cnt < MIN_IMAGES]
        if low_classes:
            print(f"\n  ⚠  Classes with fewer than {MIN_IMAGES} images:")
            for cls in sorted(low_classes, key=lambda x: int(x) if x.isdigit() else x):
                print(f"       Class {cls}: {counts[cls]} image(s)")

        grand_total   += ds_total
        grand_corrupt += corrupt
        print()

    # ── Grand summary ────────────────────────────────────────────────────
    print(f"{'═'*60}")
    print("  SUMMARY")
    print(f"{'═'*60}")
    print(f"  Total images across all datasets : {grand_total}")
    print(f"  Total corrupt / unreadable       : {len(grand_corrupt)}")
    if grand_corrupt:
        print("\n  All corrupt files:")
        for p in grand_corrupt:
            print(f"    {p}")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    main()
