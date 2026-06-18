"""
Ancient Tamil Inscription Classifier — Robust Retrainer
========================================================
Fine-tunes the existing model with heavy augmentations that
simulate real stone-inscription crops (noise, blur, distortion,
texture effects) so the model generalises beyond clean training images.

Usage
-----
    cd "E:\\TAMIL SCRIPT VERSION 2"
    venv\\Scripts\\activate
    python backend\\retrain_robust.py

Output
------
    models/ancient_tamil_classifier.pth   ← best model (overwrites)
    models/checkpoint_robust.pth          ← per-epoch checkpoint
"""

import copy
import json
import os
import time
import warnings
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.cuda.amp import GradScaler, autocast
from torch.utils.data import Dataset, DataLoader, ConcatDataset, Subset
from torchvision.datasets import ImageFolder
from PIL import Image

import albumentations as A
from albumentations.pytorch import ToTensorV2

from sklearn.model_selection import StratifiedShuffleSplit

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
#  PATHS  (match train.py exactly)
# ─────────────────────────────────────────────
BASE_DIR       = Path(r"E:\TAMIL SCRIPT VERSION 2")
DATA_DIR       = BASE_DIR / "TAMIL SCRIPT DATASET"
ANCIENT_DIR    = DATA_DIR / "images_categorised"
AUGMENTED_DIR  = DATA_DIR / "augmented_images"

OUT_DIR        = BASE_DIR / "models"
OUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_PATH    = OUT_DIR / "ancient_tamil_classifier.pth"   # overwritten with best
CLASS_IDX_PATH = OUT_DIR / "class_to_idx.json"
CKPT_PATH      = OUT_DIR / "checkpoint_robust.pth"
CURVE_PATH     = OUT_DIR / "training_curve_robust.png"

# ─────────────────────────────────────────────
#  HYPERPARAMETERS
# ─────────────────────────────────────────────
NUM_CLASSES  = 28
BATCH_SIZE   = 16
EPOCHS       = 30
LR           = 5e-5
WEIGHT_DECAY = 1e-4
VAL_SPLIT    = 0.15
IMG_SIZE     = 224
NUM_WORKERS  = 0           # Windows: keep at 0

DEVICE  = torch.device("cuda" if torch.cuda.is_available() else "cpu")
USE_AMP = torch.cuda.is_available()
print(f"[INFO] Device: {DEVICE}  |  Mixed precision: {USE_AMP}")

# ─────────────────────────────────────────────
#  AUGMENTATION PIPELINES
# ─────────────────────────────────────────────
train_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.OneOf([
        A.GaussNoise(var_limit=(10, 50)),
        A.ISONoise(),
    ], p=0.7),
    A.OneOf([
        A.MotionBlur(blur_limit=3),
        A.GaussianBlur(blur_limit=3),
        A.MedianBlur(blur_limit=3),
    ], p=0.5),
    A.RandomBrightnessContrast(
        brightness_limit=0.4,
        contrast_limit=0.4, p=0.8),
    A.OneOf([
        A.ElasticTransform(alpha=30, sigma=5),
        A.GridDistortion(num_steps=3, distort_limit=0.2),
        A.OpticalDistortion(distort_limit=0.2),
    ], p=0.5),
    A.Rotate(limit=15, p=0.6),
    A.CoarseDropout(
        max_holes=4, max_height=20, max_width=20, p=0.4),
    # Simulate stone texture
    A.OneOf([
        A.Sharpen(alpha=(0.2, 0.5)),
        A.Emboss(alpha=(0.2, 0.5)),
    ], p=0.5),
    A.HueSaturationValue(
        hue_shift_limit=20,
        sat_shift_limit=40,
        val_shift_limit=30, p=0.6),
    A.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]),
    ToTensorV2()
])

val_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]),
    ToTensorV2()
])

# ─────────────────────────────────────────────
#  DATASET HELPERS
# ─────────────────────────────────────────────
class RawImageFolder(ImageFolder):
    """ImageFolder that returns raw PIL images (no transform applied)."""
    def __getitem__(self, index):
        path, target = self.samples[index]
        img = self.loader(path)
        return img, target


class AlbumentationsSubset(Dataset):
    """
    Wraps a Subset of PIL-image pairs and applies an Albumentations transform.
    PIL → numpy (RGB) → albumentations → tensor
    """
    def __init__(self, subset: Subset, transform: A.Compose):
        self.subset    = subset
        self.transform = transform

    def __len__(self):
        return len(self.subset)

    def __getitem__(self, idx):
        pil_img, label = self.subset[idx]
        # PIL → numpy uint8 RGB (required by Albumentations)
        img_np = np.array(pil_img.convert("RGB"), dtype=np.uint8)
        if self.transform:
            augmented = self.transform(image=img_np)
            img_tensor = augmented["image"]
        else:
            img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).float() / 255.0
        return img_tensor, label


def load_combined_dataset():
    """
    Load images_categorised + augmented_images into a single raw dataset.
    Verifies class_to_idx consistency between both folders.
    """
    ds_ancient   = RawImageFolder(str(ANCIENT_DIR))
    ds_augmented = RawImageFolder(str(AUGMENTED_DIR))

    assert ds_ancient.class_to_idx == ds_augmented.class_to_idx, (
        "class_to_idx mismatch between images_categorised and augmented_images!"
    )

    class_to_idx = ds_ancient.class_to_idx
    print(f"[INFO] Classes found   : {sorted(class_to_idx.keys())}")
    print(f"[INFO] Ancient images  : {len(ds_ancient)}")
    print(f"[INFO] Augmented images: {len(ds_augmented)}")

    combined = ConcatDataset([ds_ancient, ds_augmented])
    targets  = ([s[1] for s in ds_ancient.samples] +
                [s[1] for s in ds_augmented.samples])
    return combined, targets, class_to_idx


def stratified_split(dataset, targets, val_size=VAL_SPLIT, seed=42):
    sss = StratifiedShuffleSplit(n_splits=1, test_size=val_size, random_state=seed)
    idx = np.arange(len(targets))
    train_idx, val_idx = next(sss.split(idx, targets))
    return Subset(dataset, train_idx), Subset(dataset, val_idx)


# ─────────────────────────────────────────────
#  MODEL — load existing weights as starting point
# ─────────────────────────────────────────────
def build_model_from_checkpoint(checkpoint_path: Path, num_classes: int) -> nn.Module:
    """
    Build EfficientNet-B0 and load weights from the existing trained checkpoint.
    Fine-tuning from current weights, NOT from ImageNet scratch.
    """
    try:
        from efficientnet_pytorch import EfficientNet
        model = EfficientNet.from_pretrained("efficientnet-b0")
        model._fc = nn.Linear(model._fc.in_features, num_classes)
        print("[INFO] Using efficientnet_pytorch EfficientNet-B0")
    except ImportError:
        from torchvision import models
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(
            model.classifier[1].in_features, num_classes
        )
        print("[INFO] Using torchvision EfficientNet-B0")

    if checkpoint_path.exists():
        ckpt  = torch.load(str(checkpoint_path), map_location="cpu")
        state = ckpt.get("model_state_dict", ckpt)
        model.load_state_dict(state)
        print(f"[INFO] Loaded existing weights from: {checkpoint_path}")
    else:
        print(f"[WARN] No checkpoint found at {checkpoint_path}. "
              "Starting from ImageNet pretrained weights.")

    model.to(DEVICE)
    model.eval()
    return model


# ─────────────────────────────────────────────
#  TRAINING & VALIDATION LOOPS
# ─────────────────────────────────────────────
def train_one_epoch(model, loader, criterion, optimizer, scaler):
    model.train()
    running_loss = 0.0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        if USE_AMP:
            with autocast():
                outputs = model(imgs)
                loss    = criterion(outputs, labels)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            outputs = model(imgs)
            loss    = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
        running_loss += loss.item() * imgs.size(0)
    return running_loss / len(loader.dataset)


@torch.no_grad()
def validate(model, loader, criterion):
    model.eval()
    running_loss = 0.0
    correct      = 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        if USE_AMP:
            with autocast():
                outputs = model(imgs)
                loss    = criterion(outputs, labels)
        else:
            outputs = model(imgs)
            loss    = criterion(outputs, labels)
        running_loss += loss.item() * imgs.size(0)
        preds   = outputs.argmax(dim=1)
        correct += (preds == labels).sum().item()
    return running_loss / len(loader.dataset), correct / len(loader.dataset)


# ─────────────────────────────────────────────
#  CHECKPOINT HELPERS
# ─────────────────────────────────────────────
def save_checkpoint(epoch, model, optimizer, scheduler, best_acc):
    torch.save({
        "epoch":                epoch,
        "model_state_dict":     model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_state_dict": scheduler.state_dict(),
        "best_val_acc":         best_acc,
    }, str(CKPT_PATH))


# ─────────────────────────────────────────────
#  TRAINING CURVE PLOT
# ─────────────────────────────────────────────
def save_training_curve(history: dict):
    epochs_r = range(1, len(history["train_loss"]) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("Robust Retraining — Training Curves", fontsize=14)

    ax1.plot(epochs_r, history["train_loss"], label="Train Loss", color="#2196F3")
    ax1.plot(epochs_r, history["val_loss"],   label="Val Loss",   color="#F44336")
    ax1.set_xlabel("Epoch"); ax1.set_ylabel("Loss")
    ax1.set_title("Loss"); ax1.legend(); ax1.grid(True, alpha=0.3)

    ax2.plot(epochs_r, history["val_acc"], label="Val Accuracy", color="#4CAF50")
    ax2.set_xlabel("Epoch"); ax2.set_ylabel("Accuracy")
    ax2.set_title("Validation Accuracy"); ax2.legend(); ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(str(CURVE_PATH), dpi=150)
    plt.close()
    print(f"[INFO] Training curve saved → {CURVE_PATH}")


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    # ── Data ──────────────────────────────────────────────────────────────
    print("\n[STEP 1] Loading dataset ...")
    combined_ds, all_targets, class_to_idx = load_combined_dataset()
    train_raw, val_raw = stratified_split(combined_ds, all_targets)
    print(f"[INFO] Train samples: {len(train_raw)}  |  Val samples: {len(val_raw)}")

    train_ds = AlbumentationsSubset(train_raw, train_transform)
    val_ds   = AlbumentationsSubset(val_raw,   val_transform)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=NUM_WORKERS, pin_memory=USE_AMP)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, pin_memory=USE_AMP)

    # ── Model — fine-tune from existing weights ────────────────────────────
    print("\n[STEP 2] Loading existing model weights for fine-tuning ...")
    model = build_model_from_checkpoint(OUTPUT_PATH, NUM_CLASSES)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    scaler    = GradScaler(enabled=USE_AMP)

    history  = {"train_loss": [], "val_loss": [], "val_acc": []}
    best_acc = 0.0
    best_weights = copy.deepcopy(model.state_dict())

    # ── Training loop ─────────────────────────────────────────────────────
    print(f"\n[STEP 3] Fine-tuning with stone-texture augmentations — {EPOCHS} epochs")
    print(f"         LR={LR}  |  Batch={BATCH_SIZE}  |  Scheduler=CosineAnnealingLR")
    print("-" * 72)

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()

        tr_loss           = train_one_epoch(model, train_loader, criterion, optimizer, scaler)
        val_loss, val_acc = validate(model, val_loader, criterion)
        scheduler.step()
        lr_now = scheduler.get_last_lr()[0]

        history["train_loss"].append(tr_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        improved = val_acc > best_acc
        if improved:
            best_acc     = val_acc
            best_weights = copy.deepcopy(model.state_dict())

        # Per-epoch checkpoint
        save_checkpoint(epoch, model, optimizer, scheduler, best_acc)

        marker = "  ← best" if improved else ""
        print(f"  Epoch {epoch:>2}/{EPOCHS}  "
              f"loss={tr_loss:.4f}  val_loss={val_loss:.4f}  "
              f"val_acc={val_acc:.4f}  lr={lr_now:.2e}  "
              f"time={time.time()-t0:.1f}s{marker}")

    # ── Save best model back to OUTPUT_PATH ───────────────────────────────
    print(f"\n[STEP 4] Saving best model (val_acc={best_acc:.4f}) → {OUTPUT_PATH}")
    torch.save({
        "model_state_dict": best_weights,
        "class_to_idx":     class_to_idx,
        "num_classes":      NUM_CLASSES,
        "img_size":         IMG_SIZE,
    }, str(OUTPUT_PATH))

    # Also save class_to_idx (unchanged, but ensure it's up to date)
    with open(CLASS_IDX_PATH, "w", encoding="utf-8") as f:
        json.dump(class_to_idx, f, indent=2, ensure_ascii=False)

    # ── Training curve ────────────────────────────────────────────────────
    print("\n[STEP 5] Saving training curve ...")
    save_training_curve(history)

    print(f"\n✅ Robust retraining complete!")
    print(f"   Best val accuracy  : {best_acc:.4f}")
    print(f"   Model saved        : {OUTPUT_PATH}")
    print(f"   Per-epoch checkpoint: {CKPT_PATH}")
    print(f"   Training curve     : {CURVE_PATH}")
    print(f"\n   Restart the backend to load the new weights:")
    print(f"   cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000")


if __name__ == "__main__":
    main()
