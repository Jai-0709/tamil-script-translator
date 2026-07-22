"""
Kaggle Training Script for Ancient Tamil Inscription Translator
================================================================
This script combines base training and robust stone-texture fine-tuning into 
a single run. It automatically locates the dataset in Kaggle inputs, runs 
the training on GPU (if available), and outputs the final model and index map.

Usage on Kaggle:
1. Create a new notebook on Kaggle.
2. In the notebook settings (right panel), under "Accelerator", select "GPU T4".
3. Add your uploaded "dataset_clean" dataset to the notebook.
4. Copy-paste this entire file into a cell and run it.
"""

import os
import sys
import json
import time
import copy
import warnings
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, ConcatDataset, Subset
from torchvision import transforms, models
from torchvision.datasets import ImageFolder
from torch.cuda.amp import GradScaler, autocast
from PIL import Image

# Import albumentations (pre-installed on Kaggle)
try:
    import albumentations as A
    from albumentations.pytorch import ToTensorV2
    ALBU_AVAILABLE = True
except ImportError:
    ALBU_AVAILABLE = False

try:
    import timm
    TIMM_AVAILABLE = True
except ImportError:
    TIMM_AVAILABLE = False
    print("[WARNING] 'timm' library not found. ViT training requires timm. Run: pip install timm")

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
#  PATH RESOLUTION
# ─────────────────────────────────────────────
# Automatically find 'dataset_clean' under Kaggle input paths, or fall back to local
KAGGLE_INPUT = Path("/kaggle/input")
DATA_DIR = None

if KAGGLE_INPUT.exists():
    print("[INFO] Running on Kaggle. Searching for 'train' folder...")
    for p in KAGGLE_INPUT.rglob("train"):
        if p.is_dir():
            DATA_DIR = p
            break

if DATA_DIR is None:
    # Local fallback, safely handling __file__ if in a notebook
    try:
        base_path = Path(__file__).resolve().parent
    except NameError:
        base_path = Path.cwd()
    DATA_DIR = base_path / "dataset" / "classification" / "train"

if not DATA_DIR.exists():
    print(f"[ERROR] Dataset directory not found at: {DATA_DIR}")
    print("Please upload the dataset zip and ensure it contains the 'train' folder.")
    import sys
    sys.exit(1)

print(f"[INFO] Using dataset path: {DATA_DIR}")

# Output paths
try:
    base_path_out = Path(__file__).resolve().parent
except NameError:
    base_path_out = Path.cwd()

OUT_DIR = Path("/kaggle/working") if KAGGLE_INPUT.exists() else base_path_out / "models"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = OUT_DIR / "ancient_tamil_classifier.pth"
CLASS_IDX_PATH = OUT_DIR / "class_to_idx.json"
BASE_CURVE_PATH = OUT_DIR / "training_curve.png"
ROBUST_CURVE_PATH = OUT_DIR / "training_curve_robust.png"

# Device setup
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
USE_AMP = torch.cuda.is_available()
print(f"[INFO] Device detected: {DEVICE}  |  Mixed precision: {USE_AMP}")

# ─────────────────────────────────────────────
#  HYPERPARAMETERS
# ─────────────────────────────────────────────
BATCH_SIZE = 32
FREEZE_EPOCHS = 5
UNFREEZE_EPOCHS = 45
ROBUST_EPOCHS = 30
LR = 1e-4
WEIGHT_DECAY = 1e-4
LABEL_SMOOTHING = 0.1
EARLY_STOP_PAT = 10
VAL_SPLIT = 0.15
IMG_SIZE = 224
NUM_WORKERS = 2 if DEVICE.type == "cuda" else 0

# ─────────────────────────────────────────────
#  DATASET WRAPPERS
# ─────────────────────────────────────────────
class RawImageFolder(ImageFolder):
    def __getitem__(self, index):
        path, target = self.samples[index]
        img = self.loader(path)
        return img, target

class TransformSubset(Dataset):
    def __init__(self, subset: Subset, transform):
        self.subset = subset
        self.transform = transform
    def __len__(self):
        return len(self.subset)
    def __getitem__(self, idx):
        img, label = self.subset[idx]
        if self.transform:
            img = self.transform(img)
        return img, label

class AlbumentationsSubset(Dataset):
    def __init__(self, subset: Subset, transform: A.Compose):
        self.subset = subset
        self.transform = transform
    def __len__(self):
        return len(self.subset)
    def __getitem__(self, idx):
        pil_img, label = self.subset[idx]
        img_np = np.array(pil_img.convert("RGB"), dtype=np.uint8)
        if self.transform:
            augmented = self.transform(image=img_np)
            img_tensor = augmented["image"]
        else:
            img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).float() / 255.0
        return img_tensor, label

# ─────────────────────────────────────────────
#  TRANSFORMS
# ─────────────────────────────────────────────
# Base Training Transforms
base_train_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(p=0.3),
    transforms.RandomRotation(degrees=10),
    transforms.ColorJitter(brightness=0.3, contrast=0.3),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

base_val_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# Robust Training Augmentations (Albumentations)
if ALBU_AVAILABLE:
    robust_train_transform = A.Compose([
        A.Resize(IMG_SIZE, IMG_SIZE),
        A.OneOf([A.GaussNoise(var_limit=(10, 50)), A.ISONoise()], p=0.7),
        A.OneOf([A.MotionBlur(blur_limit=3), A.GaussianBlur(blur_limit=3), A.MedianBlur(blur_limit=3)], p=0.5),
        A.RandomBrightnessContrast(brightness_limit=0.4, contrast_limit=0.4, p=0.8),
        A.OneOf([A.ElasticTransform(alpha=30, sigma=5), A.GridDistortion(num_steps=3, distort_limit=0.2), A.OpticalDistortion(distort_limit=0.2)], p=0.5),
        A.Rotate(limit=15, p=0.6),
        A.CoarseDropout(max_holes=4, max_height=20, max_width=20, p=0.4),
        A.OneOf([A.Sharpen(alpha=(0.2, 0.5)), A.Emboss(alpha=(0.2, 0.5))], p=0.5),
        A.HueSaturationValue(hue_shift_limit=20, sat_shift_limit=40, val_shift_limit=30, p=0.6),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2()
    ])

    robust_val_transform = A.Compose([
        A.Resize(IMG_SIZE, IMG_SIZE),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2()
    ])

# ─────────────────────────────────────────────
#  MODEL SETUP
# ─────────────────────────────────────────────
def build_model(num_classes: int):
    if not TIMM_AVAILABLE:
        raise ImportError("timm library is required for Vision Transformer. Run: !pip install timm")
    
    # Load a pretrained Vision Transformer (ViT-Tiny)
    # Patch size 16, Input size 224
    print("[INFO] Loading Vision Transformer (vit_tiny_patch16_224) via timm...")
    model = timm.create_model("vit_tiny_patch16_224", pretrained=True, num_classes=num_classes)
    return model

def freeze_backbone(model):
    # Freeze all layers
    for param in model.parameters():
        param.requires_grad = False
    
    # Unfreeze only the classification head
    if hasattr(model, 'head'):
        for param in model.head.parameters():
            param.requires_grad = True
    elif hasattr(model, 'fc'): # some timm models use fc
        for param in model.fc.parameters():
            param.requires_grad = True

def unfreeze_all(model):
    for param in model.parameters():
        param.requires_grad = True

# ─────────────────────────────────────────────
#  TRAINING LOOPS
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
    return running_loss / len(loader.dataset), correct / len(loader.dataset)

def plot_curves(history: dict, path: Path, title: str):
    epochs_range = range(1, len(history["train_loss"]) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(title, fontsize=14)

    ax1.plot(epochs_range, history["train_loss"], label="Train Loss", color="#2196F3")
    ax1.plot(epochs_range, history["val_loss"], label="Val Loss", color="#F44336")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(epochs_range, history["val_acc"], label="Val Accuracy", color="#4CAF50")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Accuracy")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(str(path), dpi=150)
    plt.close()
    print(f"[INFO] Saved training curve → {path}")

# ─────────────────────────────────────────────
#  EXECUTION FLOW
# ─────────────────────────────────────────────
def main():
    # ── STEP 1: Load Dataset ──────────────────────────────────────────────────
    print("\n" + "="*50)
    print(" 1. LOADING DATASET")
    print("="*50)
    
    dataset = RawImageFolder(str(DATA_DIR))
    class_to_idx = dataset.class_to_idx
    num_classes = len(class_to_idx)
    targets = [s[1] for s in dataset.samples]
    
    print(f"[INFO] Found {num_classes} classes.")
    print(f"[INFO] Total images: {len(dataset)}")
    
    # Save class mapping
    with open(CLASS_IDX_PATH, "w", encoding="utf-8") as f:
        json.dump(class_to_idx, f, indent=2, ensure_ascii=False)
    print(f"[INFO] Saved class_to_idx.json → {CLASS_IDX_PATH}")
    
    # Standard Split (85% Train, 15% Val) 
    # (Cannot use StratifiedSplit because some classes only have 1 image)
    from sklearn.model_selection import train_test_split
    indices = np.arange(len(targets))
    train_idx, val_idx = train_test_split(indices, test_size=VAL_SPLIT, random_state=42, stratify=None)
    
    train_raw = Subset(dataset, train_idx)
    val_raw = Subset(dataset, val_idx)
    print(f"[INFO] Split: {len(train_raw)} train samples, {len(val_raw)} val samples")
    
    # ── STEP 2: Base Training ─────────────────────────────────────────────────
    print("\n" + "="*50)
    print(" 2. RUNNING BASE TRAINING")
    print("="*50)
    
    train_ds = TransformSubset(train_raw, base_train_transform)
    val_ds = TransformSubset(val_raw, base_val_transform)
    
    # Calculate weights for Balanced Sampling (crucial for severe class imbalance!)
    print("\n[INFO] Calculating class weights for WeightedRandomSampler...")
    class_counts = [0] * num_classes
    for idx in train_idx:
        _, label = dataset.samples[idx]
        class_counts[label] += 1
        
    class_weights = [1.0 / max(1, c) for c in class_counts]
    sample_weights = [class_weights[dataset.samples[i][1]] for i in train_idx]
    
    from torch.utils.data import WeightedRandomSampler
    sampler = WeightedRandomSampler(weights=sample_weights, num_samples=len(train_idx), replacement=True)
    
    # Use the sampler for the train_loader (do NOT use shuffle=True when using a sampler)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler, num_workers=NUM_WORKERS, pin_memory=USE_AMP)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS, pin_memory=USE_AMP)
    
    model = build_model(num_classes).to(DEVICE)
    criterion = nn.CrossEntropyLoss(label_smoothing=LABEL_SMOOTHING)
    scaler = GradScaler(enabled=USE_AMP)
    
    # Phase 2.1: Frozen backbone (5 epochs)
    print(f"\n[PHASE 1] Training Classifier head ({FREEZE_EPOCHS} epochs)...")
    freeze_backbone(model)
    optimizer = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=FREEZE_EPOCHS)
    
    history_base = {"train_loss": [], "val_loss": [], "val_acc": []}
    best_acc = 0.0
    best_weights = None
    
    for epoch in range(1, FREEZE_EPOCHS + 1):
        t0 = time.time()
        loss_t = train_one_epoch(model, train_loader, criterion, optimizer, scaler)
        loss_v, acc_v = validate(model, val_loader, criterion)
        scheduler.step()
        
        history_base["train_loss"].append(loss_t)
        history_base["val_loss"].append(loss_v)
        history_base["val_acc"].append(acc_v)
        
        if acc_v > best_acc:
            best_acc = acc_v
            best_weights = copy.deepcopy(model.state_dict())
            
        print(f"  Epoch {epoch}/{FREEZE_EPOCHS} | Train Loss: {loss_t:.4f} | Val Loss: {loss_v:.4f} | Val Acc: {acc_v:.4f} | Time: {time.time()-t0:.1f}s")
        
    # Phase 2.2: Full Fine-tuning (45 epochs)
    print(f"\n[PHASE 2] Fine-tuning entire model ({UNFREEZE_EPOCHS} epochs)...")
    unfreeze_all(model)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=UNFREEZE_EPOCHS)
    no_improve = 0
    
    for epoch in range(1, UNFREEZE_EPOCHS + 1):
        t0 = time.time()
        loss_t = train_one_epoch(model, train_loader, criterion, optimizer, scaler)
        loss_v, acc_v = validate(model, val_loader, criterion)
        scheduler.step()
        
        history_base["train_loss"].append(loss_t)
        history_base["val_loss"].append(loss_v)
        history_base["val_acc"].append(acc_v)
        
        improved = acc_v > best_acc
        if improved:
            best_acc = acc_v
            best_weights = copy.deepcopy(model.state_dict())
            no_improve = 0
        else:
            no_improve += 1
            
        marker = "  ← best" if improved else ""
        print(f"  Epoch {epoch}/{UNFREEZE_EPOCHS} | Train Loss: {loss_t:.4f} | Val Loss: {loss_v:.4f} | Val Acc: {acc_v:.4f} | Time: {time.time()-t0:.1f}s{marker}")
        
        if no_improve >= EARLY_STOP_PAT:
            print(f"[INFO] Early stopping triggered after {EARLY_STOP_PAT} epochs of no improvement.")
            break
            
    # Load best weights
    model.load_state_dict(best_weights)
    plot_curves(history_base, BASE_CURVE_PATH, "Base Training Curves")
    
    # ── STEP 3: Robust Fine-Tuning ────────────────────────────────────────────
    print("\n" + "="*50)
    print(" 3. RUNNING ROBUST FINE-TUNING")
    print("="*50)
    
    if not ALBU_AVAILABLE:
        print("[WARN] Albumentations is not available. Skipping robust fine-tuning.")
        torch.save({
            "model_state_dict": model.state_dict(),
            "class_to_idx": class_to_idx,
            "num_classes": num_classes,
            "img_size": IMG_SIZE
        }, str(MODEL_PATH))
        print(f"Saved model directly to: {MODEL_PATH}")
        return
        
    train_ds_robust = AlbumentationsSubset(train_raw, robust_train_transform)
    val_ds_robust = AlbumentationsSubset(val_raw, robust_val_transform)
    
    train_loader = DataLoader(train_ds_robust, batch_size=BATCH_SIZE, shuffle=True, num_workers=NUM_WORKERS, pin_memory=USE_AMP)
    val_loader = DataLoader(val_ds_robust, batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS, pin_memory=USE_AMP)
    
    # Fine-tuning at lower learning rate
    optimizer = optim.AdamW(model.parameters(), lr=5e-5, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=ROBUST_EPOCHS)
    
    history_robust = {"train_loss": [], "val_loss": [], "val_acc": []}
    best_acc = 0.0
    best_weights = copy.deepcopy(model.state_dict())
    
    for epoch in range(1, ROBUST_EPOCHS + 1):
        t0 = time.time()
        loss_t = train_one_epoch(model, train_loader, criterion, optimizer, scaler)
        loss_v, acc_v = validate(model, val_loader, criterion)
        scheduler.step()
        
        history_robust["train_loss"].append(loss_t)
        history_robust["val_loss"].append(loss_v)
        history_robust["val_acc"].append(acc_v)
        
        improved = acc_v > best_acc
        if improved:
            best_acc = acc_v
            best_weights = copy.deepcopy(model.state_dict())
            
        marker = "  ← best" if improved else ""
        print(f"  Epoch {epoch}/{ROBUST_EPOCHS} | Train Loss: {loss_t:.4f} | Val Loss: {loss_v:.4f} | Val Acc: {acc_v:.4f} | Time: {time.time()-t0:.1f}s{marker}")
        
    # Save the final best weights
    torch.save({
        "model_state_dict": best_weights,
        "class_to_idx": class_to_idx,
        "num_classes": num_classes,
        "img_size": IMG_SIZE
    }, str(MODEL_PATH))
    
    plot_curves(history_robust, ROBUST_CURVE_PATH, "Robust Retraining Curves")
    
    print("\n" + "="*50)
    print(" TRAINING COMPLETE!")
    print("="*50)
    print(f"Final model weights saved to  : {MODEL_PATH}")
    print(f"Final class indices saved to  : {CLASS_IDX_PATH}")
    print(f"Saved base curves plot to     : {BASE_CURVE_PATH}")
    print(f"Saved robust curves plot to   : {ROBUST_CURVE_PATH}")
    print("Download these files from the Kaggle Output section and copy them to your local 'models/' directory!")
    print("="*50)

if __name__ == "__main__":
    main()
