"""
Ancient Tamil Inscription Classifier - Model Test Script
Loads trained model, runs inference on 5 random images per class,
and prints a formatted results table with final accuracy.
"""

import json
import random
import warnings
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms, models
from PIL import Image

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────────
BASE_DIR       = Path(r"E:\TAMIL SCRIPT VERSION 2")
MODEL_PATH     = BASE_DIR / "models" / "ancient_tamil_classifier.pth"
CLASS_IDX_PATH = BASE_DIR / "models" / "class_to_idx.json"
ANCIENT_DIR    = BASE_DIR / "TAMIL SCRIPT DATASET" / "images_categorised"

DEVICE     = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE   = 224
SAMPLES    = 5          # images per class
SEED       = 42
IMG_EXTS   = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}

# ─────────────────────────────────────────────
#  TRANSFORM  (must match training val_transform)
# ─────────────────────────────────────────────
infer_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# ─────────────────────────────────────────────
#  LOAD MODEL
# ─────────────────────────────────────────────
def load_model(model_path: Path):
    # Step 1: load raw checkpoint
    ckpt  = torch.load(str(model_path), map_location="cpu")
    state = ckpt.get("model_state_dict", ckpt)

    # Step 2: determine num_classes from checkpoint (never hardcode)
    if "num_classes" in ckpt:
        num_classes = ckpt["num_classes"]
    elif "_fc.weight" in state:
        num_classes = state["_fc.weight"].shape[0]       # efficientnet_pytorch
    elif "classifier.1.weight" in state:
        num_classes = state["classifier.1.weight"].shape[0]  # torchvision
    else:
        raise KeyError("Cannot infer num_classes from checkpoint keys.")

    print(f"[INFO] num_classes from checkpoint: {num_classes}")

    # Step 3: build model with the correct head size
    try:
        from efficientnet_pytorch import EfficientNet
        model = EfficientNet.from_pretrained("efficientnet-b0")
        in_features = model._fc.in_features
        model._fc   = nn.Linear(in_features, num_classes)
    except ImportError:
        model = models.efficientnet_b0(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, num_classes)

    # Step 4: load weights
    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    return model, num_classes


# ─────────────────────────────────────────────
#  INFERENCE
# ─────────────────────────────────────────────
@torch.no_grad()
def predict(model, img_path: Path):
    img    = Image.open(str(img_path)).convert("RGB")
    tensor = infer_transform(img).unsqueeze(0).to(DEVICE)
    logits = model(tensor)
    probs  = F.softmax(logits, dim=1)
    conf, pred_idx = probs.max(dim=1)
    return int(pred_idx.item()), float(conf.item())


# ─────────────────────────────────────────────
#  COLLECT TEST IMAGES
# ─────────────────────────────────────────────
def collect_samples(ancient_dir: Path, samples_per_class: int, seed: int):
    """Return list of (true_class_str, img_path) tuples."""
    rng     = random.Random(seed)
    results = []

    class_folders = sorted(
        [d for d in ancient_dir.iterdir() if d.is_dir()],
        key=lambda d: int(d.name)
    )

    if not class_folders:
        raise FileNotFoundError(f"No class folders found in {ancient_dir}")

    for folder in class_folders:
        images = [
            p for p in folder.iterdir()
            if p.is_file() and p.suffix.lower() in IMG_EXTS
        ]
        if not images:
            print(f"  [WARN] No images found in class folder: {folder.name}")
            continue

        chosen = rng.sample(images, min(samples_per_class, len(images)))
        for img_path in chosen:
            results.append((folder.name, img_path))

    return results, [f.name for f in class_folders]


# ─────────────────────────────────────────────
#  PRINT TABLE
# ─────────────────────────────────────────────
def print_table(rows):
    col_w = [10, 12, 9, 12]
    header = (
        f"{'Class':<{col_w[0]}} "
        f"{'Predicted':<{col_w[1]}} "
        f"{'Correct':<{col_w[2]}} "
        f"{'Confidence':<{col_w[3]}}"
    )
    sep = "-" * (sum(col_w) + 3)
    print("\n" + sep)
    print(header)
    print(sep)
    for true_cls, pred_cls, correct, conf in rows:
        tick = "✓" if correct else "✗"
        print(
            f"{str(true_cls):<{col_w[0]}} "
            f"{str(pred_cls):<{col_w[1]}} "
            f"{tick:<{col_w[2]}} "
            f"{conf*100:>8.2f}%"
        )
    print(sep)


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    # ── Validate paths ───────────────────────
    if not MODEL_PATH.exists():
        print(f"[ERROR] Model not found: {MODEL_PATH}")
        print("        Run train.py first to generate the model.")
        return
    if not CLASS_IDX_PATH.exists():
        print(f"[ERROR] class_to_idx.json not found: {CLASS_IDX_PATH}")
        return
    if not ANCIENT_DIR.exists():
        print(f"[ERROR] Dataset directory not found: {ANCIENT_DIR}")
        return

    # ── Load class mapping ───────────────────
    with open(CLASS_IDX_PATH, "r", encoding="utf-8") as f:
        class_to_idx = json.load(f)   # {"0": 0, "1": 1, ...}
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    num_classes  = len(class_to_idx)
    print(f"[INFO] Loaded class map  : {num_classes} classes")

    # ── Load model (num_classes read from checkpoint, not from class_to_idx)
    print(f"[INFO] Loading model from: {MODEL_PATH}")
    model, num_classes = load_model(MODEL_PATH)
    print(f"[INFO] Device            : {DEVICE}")

    # ── Collect samples ──────────────────────
    print(f"[INFO] Sampling {SAMPLES} images per class from: {ANCIENT_DIR}\n")
    samples, class_names = collect_samples(ANCIENT_DIR, SAMPLES, SEED)
    print(f"[INFO] Total test images : {len(samples)}")

    # ── Run inference ─────────────────────────
    rows       = []
    total      = 0
    correct_ct = 0

    for true_cls_str, img_path in samples:
        true_idx    = class_to_idx.get(true_cls_str, -1)
        pred_idx, conf = predict(model, img_path)
        pred_cls_str   = idx_to_class.get(pred_idx, str(pred_idx))
        correct        = (pred_idx == true_idx)

        rows.append((true_cls_str, pred_cls_str, correct, conf))
        total      += 1
        correct_ct += int(correct)

    # ── Print table ───────────────────────────
    print_table(rows)

    accuracy = correct_ct / total if total > 0 else 0.0
    print(f"\n  Total images  : {total}")
    print(f"  Correct       : {correct_ct}")
    print(f"  Final Accuracy: {accuracy*100:.2f}%\n")

    # ── Per-class breakdown ───────────────────
    print("Per-class accuracy:")
    class_stats = {}
    for true_cls, pred_cls, correct, _ in rows:
        class_stats.setdefault(true_cls, [0, 0])
        class_stats[true_cls][1] += 1
        if correct:
            class_stats[true_cls][0] += 1

    for cls in sorted(class_stats.keys(), key=lambda x: int(x)):
        c, t = class_stats[cls]
        bar = "█" * c + "░" * (t - c)
        print(f"  Class {cls:>2}: {c}/{t}  [{bar}]  {c/t*100:.0f}%")

    print()


if __name__ == "__main__":
    main()
