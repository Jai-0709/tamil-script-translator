"""
Ancient Tamil Inscription Classifier - Training Script
Model: EfficientNet-B0 (pretrained)
Classes: 28 (ancient Tamil characters 0-27)
"""

import os
import sys
import json
import time
import copy
import warnings
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, ConcatDataset, Subset
from torchvision import transforms, models
from torchvision.datasets import ImageFolder
from torch.cuda.amp import GradScaler, autocast

from sklearn.model_selection import StratifiedShuffleSplit
from PIL import Image

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────────
BASE_DIR        = Path(r"E:\TAMIL SCRIPT VERSION 2")
DATA_DIR        = BASE_DIR / "TAMIL SCRIPT DATASET"
ANCIENT_DIR     = DATA_DIR / "images_categorised"
AUGMENTED_DIR   = DATA_DIR / "augmented_images"

OUT_DIR         = BASE_DIR / "models"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH      = OUT_DIR / "ancient_tamil_classifier.pth"
CLASS_IDX_PATH  = OUT_DIR / "class_to_idx.json"
CURVE_PATH      = OUT_DIR / "training_curve.png"
CKPT_PATH       = OUT_DIR / "checkpoint_latest.pth"

# ─────────────────────────────────────────────
#  HYPERPARAMETERS
# ─────────────────────────────────────────────
NUM_CLASSES     = 28
BATCH_SIZE      = 32
FREEZE_EPOCHS   = 5
UNFREEZE_EPOCHS = 45
LR              = 1e-4
WEIGHT_DECAY    = 1e-4
LABEL_SMOOTHING = 0.1
EARLY_STOP_PAT  = 10
VAL_SPLIT       = 0.15
IMG_SIZE        = 224
NUM_WORKERS     = 4 if os.name != "nt" else 0   # Windows: use 0

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
USE_AMP = torch.cuda.is_available()
print(f"[INFO] Device: {DEVICE}  |  Mixed precision: {USE_AMP}")

# ─────────────────────────────────────────────
#  TRANSFORMS
# ─────────────────────────────────────────────
train_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(p=0.3),
    transforms.RandomRotation(degrees=10),
    transforms.ColorJitter(brightness=0.3, contrast=0.3),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

val_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# ─────────────────────────────────────────────
#  DATASET HELPERS
# ─────────────────────────────────────────────
class TransformSubset(Dataset):
    """Wraps a Subset and applies a transform."""
    def __init__(self, subset: Subset, transform):
        self.subset    = subset
        self.transform = transform

    def __len__(self):
        return len(self.subset)

    def __getitem__(self, idx):
        img, label = self.subset[idx]
        # img is already a PIL image because ImageFolder uses default loader
        if self.transform:
            img = self.transform(img)
        return img, label


class RawImageFolder(ImageFolder):
    """ImageFolder that returns raw PIL images (no transform applied)."""
    def __getitem__(self, index):
        path, target = self.samples[index]
        img = self.loader(path)
        return img, target


def load_combined_dataset():
    """
    Load images_categorised + augmented_images into a single raw dataset.
    Class names are folder names (strings "0" to "27").
    Returns dataset with sorted class-to-index mapping.
    """
    ds_ancient   = RawImageFolder(str(ANCIENT_DIR))
    ds_augmented = RawImageFolder(str(AUGMENTED_DIR))

    # Verify both datasets have the same class_to_idx
    assert ds_ancient.class_to_idx == ds_augmented.class_to_idx, (
        "class_to_idx mismatch between images_categorised and augmented_images!"
    )

    class_to_idx = ds_ancient.class_to_idx
    print(f"[INFO] Classes found: {sorted(class_to_idx.keys())}")
    print(f"[INFO] Ancient images  : {len(ds_ancient)}")
    print(f"[INFO] Augmented images: {len(ds_augmented)}")

    combined = ConcatDataset([ds_ancient, ds_augmented])
    # Build targets list for stratified split
    targets = ([s[1] for s in ds_ancient.samples] +
               [s[1] for s in ds_augmented.samples])
    return combined, targets, class_to_idx


def stratified_split(dataset, targets, val_size=VAL_SPLIT, seed=42):
    sss = StratifiedShuffleSplit(n_splits=1, test_size=val_size,
                                  random_state=seed)
    indices = np.arange(len(targets))
    train_idx, val_idx = next(sss.split(indices, targets))
    train_sub = Subset(dataset, train_idx)
    val_sub   = Subset(dataset, val_idx)
    return train_sub, val_sub


# ─────────────────────────────────────────────
#  MODEL
# ─────────────────────────────────────────────
def build_model(num_classes: int):
    try:
        from efficientnet_pytorch import EfficientNet
        model = EfficientNet.from_pretrained("efficientnet-b0")
        in_features = model._fc.in_features
        model._fc   = nn.Linear(in_features, num_classes)
        print("[INFO] Using efficientnet_pytorch EfficientNet-B0")
    except ImportError:
        # Fallback: torchvision EfficientNet-B0 (requires torchvision >= 0.13)
        model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, num_classes)
        print("[INFO] Using torchvision EfficientNet-B0")
    return model


def freeze_backbone(model):
    """Freeze all layers except the final classifier."""
    # First, freeze all parameters
    for param in model.parameters():
        param.requires_grad = False
        
    # Then explicitly unfreeze the classifier layer
    if hasattr(model, '_fc'):
        # efficientnet_pytorch
        for param in model._fc.parameters():
            param.requires_grad = True
    elif hasattr(model, 'classifier'):
        # torchvision
        for param in model.classifier.parameters():
            param.requires_grad = True


def unfreeze_all(model):
    for param in model.parameters():
        param.requires_grad = True


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
                loss = criterion(outputs, labels)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
        running_loss += loss.item() * imgs.size(0)
    return running_loss / len(loader.dataset)


@torch.no_grad()
def validate(model, loader, criterion):
    model.eval()
    running_loss = 0.0
    correct = 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        if USE_AMP:
            with autocast():
                outputs = model(imgs)
                loss = criterion(outputs, labels)
        else:
            outputs = model(imgs)
            loss = criterion(outputs, labels)
        running_loss += loss.item() * imgs.size(0)
        preds = outputs.argmax(dim=1)
        correct += (preds == labels).sum().item()
    avg_loss = running_loss / len(loader.dataset)
    accuracy = correct / len(loader.dataset)
    return avg_loss, accuracy


# ─────────────────────────────────────────────
#  TRAINING CURVE PLOT
# ─────────────────────────────────────────────
def save_training_curve(history: dict):
    epochs_f = range(1, len(history["train_loss"]) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("Ancient Tamil Classifier – Training Curves", fontsize=14)

    ax1.plot(epochs_f, history["train_loss"], label="Train Loss", color="#2196F3")
    ax1.plot(epochs_f, history["val_loss"],   label="Val Loss",   color="#F44336")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.set_title("Loss")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(epochs_f, history["val_acc"], label="Val Accuracy", color="#4CAF50")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Accuracy")
    ax2.set_title("Validation Accuracy")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(str(CURVE_PATH), dpi=150)
    plt.close()
    print(f"[INFO] Training curve saved → {CURVE_PATH}")


# ─────────────────────────────────────────────
#  CHECKPOINT HELPERS
# ─────────────────────────────────────────────
def save_checkpoint(epoch, phase, model, optimizer, scheduler, best_acc):
    torch.save({
        "epoch":                epoch,
        "phase":                phase,
        "model_state_dict":     model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_state_dict": scheduler.state_dict(),
        "best_val_acc":         best_acc,
    }, str(CKPT_PATH))


def load_checkpoint(model, optimizer, scheduler):
    """Load checkpoint if it exists. Returns (start_phase, start_epoch, best_acc)."""
    if not CKPT_PATH.exists():
        return 1, 1, 0.0
    ckpt = torch.load(str(CKPT_PATH), map_location=DEVICE)
    model.load_state_dict(ckpt["model_state_dict"])
    optimizer.load_state_dict(ckpt["optimizer_state_dict"])
    scheduler.load_state_dict(ckpt["scheduler_state_dict"])
    phase     = ckpt["phase"]
    epoch     = ckpt["epoch"]
    best_acc  = ckpt["best_val_acc"]
    print(f"[RESUMED] Resuming from Phase {phase} Epoch {epoch}")
    return phase, epoch, best_acc


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    # ── Data ──────────────────────────────────
    print("\n[STEP 1] Loading dataset ...")
    combined_ds, all_targets, class_to_idx = load_combined_dataset()
    train_raw, val_raw = stratified_split(combined_ds, all_targets)
    print(f"[INFO] Train samples: {len(train_raw)}  |  Val samples: {len(val_raw)}")

    train_ds = TransformSubset(train_raw, train_transform)
    val_ds   = TransformSubset(val_raw,   val_transform)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=NUM_WORKERS, pin_memory=USE_AMP)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, pin_memory=USE_AMP)

    # Save class_to_idx mapping
    with open(CLASS_IDX_PATH, "w", encoding="utf-8") as f:
        json.dump(class_to_idx, f, indent=2, ensure_ascii=False)
    print(f"[INFO] class_to_idx saved → {CLASS_IDX_PATH}")

    # ── Model ─────────────────────────────────
    print("\n[STEP 2] Building model ...")
    model = build_model(NUM_CLASSES).to(DEVICE)

    criterion = nn.CrossEntropyLoss(label_smoothing=LABEL_SMOOTHING)
    scaler    = GradScaler(enabled=USE_AMP)

    history = {"train_loss": [], "val_loss": [], "val_acc": []}
    best_acc       = 0.0
    best_weights   = None
    no_improve     = 0

    # ── Phase 1: Frozen backbone ───────────────
    print(f"\n[PHASE 1] Frozen backbone – {FREEZE_EPOCHS} epochs")
    freeze_backbone(model)
    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR, weight_decay=WEIGHT_DECAY
    )
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=FREEZE_EPOCHS)

    # ── Resume from checkpoint if available ───
    start_phase, resume_epoch, best_acc = load_checkpoint(model, optimizer, scheduler)
    if start_phase == 2:
        # Checkpoint is already in Phase 2 — skip Phase 1 entirely
        p1_start = FREEZE_EPOCHS + 1
    elif start_phase == 1:
        p1_start = resume_epoch + 1   # resume AFTER the saved epoch
    else:
        p1_start = 1

    for epoch in range(p1_start, FREEZE_EPOCHS + 1):
        t0 = time.time()
        tr_loss             = train_one_epoch(model, train_loader, criterion, optimizer, scaler)
        val_loss, val_acc   = validate(model, val_loader, criterion)
        scheduler.step()
        lr_now = scheduler.get_last_lr()[0]

        history["train_loss"].append(tr_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        if val_acc > best_acc:
            best_acc     = val_acc
            best_weights = copy.deepcopy(model.state_dict())

        save_checkpoint(epoch, 1, model, optimizer, scheduler, best_acc)

        print(f"  [P1] Epoch {epoch:>2}/{FREEZE_EPOCHS}  "
              f"train_loss={tr_loss:.4f}  val_loss={val_loss:.4f}  "
              f"val_acc={val_acc:.4f}  lr={lr_now:.2e}  "
              f"time={time.time()-t0:.1f}s")

    # ── Phase 2: Full fine-tuning ──────────────
    print(f"\n[PHASE 2] Full fine-tuning – {UNFREEZE_EPOCHS} epochs")
    unfreeze_all(model)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=UNFREEZE_EPOCHS)

    # ── Restore Phase 2 checkpoint state if available ─
    if start_phase == 2:
        # Re-load checkpoint into the newly created Phase 2 optimizer/scheduler
        ckpt = torch.load(str(CKPT_PATH), map_location=DEVICE)
        optimizer.load_state_dict(ckpt["optimizer_state_dict"])
        scheduler.load_state_dict(ckpt["scheduler_state_dict"])
        best_acc  = ckpt["best_val_acc"]
        p2_start  = resume_epoch + 1
    else:
        p2_start  = 1

    for epoch in range(p2_start, UNFREEZE_EPOCHS + 1):
        t0 = time.time()
        tr_loss             = train_one_epoch(model, train_loader, criterion, optimizer, scaler)
        val_loss, val_acc   = validate(model, val_loader, criterion)
        scheduler.step()
        lr_now = scheduler.get_last_lr()[0]

        history["train_loss"].append(tr_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        improved = val_acc > best_acc
        if improved:
            best_acc     = val_acc
            best_weights = copy.deepcopy(model.state_dict())
            no_improve   = 0
        else:
            no_improve += 1

        save_checkpoint(epoch, 2, model, optimizer, scheduler, best_acc)

        print(f"  [P2] Epoch {epoch:>2}/{UNFREEZE_EPOCHS}  "
              f"train_loss={tr_loss:.4f}  val_loss={val_loss:.4f}  "
              f"val_acc={val_acc:.4f}  lr={lr_now:.2e}  "
              f"time={time.time()-t0:.1f}s"
              f"{'  ← best' if improved else ''}")

        if no_improve >= EARLY_STOP_PAT:
            print(f"\n[INFO] Early stopping triggered (no improvement for {EARLY_STOP_PAT} epochs)")
            break

    # ── Save best model ────────────────────────
    print(f"\n[STEP 3] Saving best model (val_acc={best_acc:.4f}) → {MODEL_PATH}")
    torch.save({"model_state_dict": best_weights,
                "class_to_idx": class_to_idx,
                "num_classes": NUM_CLASSES,
                "img_size": IMG_SIZE}, str(MODEL_PATH))

    # ── Plot curves ────────────────────────────
    print("\n[STEP 4] Saving training curve ...")
    save_training_curve(history)

    print(f"\n✅ Training complete!")
    print(f"   Best val accuracy : {best_acc:.4f}")
    print(f"   Model saved       : {MODEL_PATH}")
    print(f"   class_to_idx      : {CLASS_IDX_PATH}")
    print(f"   Training curve    : {CURVE_PATH}")


if __name__ == "__main__":
    main()
