"""
Ancient Tamil Inscription Translator — Classifier Module
Loads the trained EfficientNet-B0 model at import time and exposes
classify_crop() and classify_batch() functions.
"""

import json
import warnings
from pathlib import Path
from typing import Dict, List

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms, models

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
#  PATHS  (relative to this file's location)
# ─────────────────────────────────────────────
_BACKEND_DIR   = Path(__file__).resolve().parent
_MODELS_DIR    = _BACKEND_DIR.parent / "models"

MODEL_PATH     = _MODELS_DIR / "ancient_tamil_classifier.pth"
CLASS_IDX_PATH = _MODELS_DIR / "class_to_idx.json"
IDX_CHARS_PATH = _MODELS_DIR / "idx_to_chars.json"

DEVICE   = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE = 224

# ─────────────────────────────────────────────
#  PREPROCESSING TRANSFORM
# ─────────────────────────────────────────────
_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# ─────────────────────────────────────────────
#  MODEL LOADING (at import time)
# ─────────────────────────────────────────────
def _load_model():
    ckpt  = torch.load(str(MODEL_PATH), map_location="cpu", weights_only=False)
    state = ckpt.get("model_state_dict", ckpt)

    # ── Detect architecture by inspecting checkpoint keys ──────────────────
    # timm ViT uses "blocks.*" / "head.*"
    # torchvision EfficientNet uses "features.*" / "classifier.*"
    # efficientnet_pytorch uses "_conv_stem.*" / "_fc.*"
    is_timm_vit = any(k.startswith("blocks.") or k.startswith("head.") for k in state.keys())
    is_torchvision = any(k.startswith("features.") for k in state.keys())

    # ── Infer num_classes from checkpoint ──────────────────────────────────
    if "num_classes" in ckpt:
        num_classes = ckpt["num_classes"]
    elif is_timm_vit and "head.weight" in state:
        num_classes = state["head.weight"].shape[0]
    elif is_torchvision and "classifier.1.weight" in state:
        num_classes = state["classifier.1.weight"].shape[0]
    elif not is_torchvision and "_fc.weight" in state:
        num_classes = state["_fc.weight"].shape[0]
    else:
        raise KeyError("Cannot infer num_classes from checkpoint.")

    print(f"[CLS] Checkpoint format: {'timm ViT' if is_timm_vit else ('torchvision' if is_torchvision else 'efficientnet_pytorch')}")
    print(f"[CLS] num_classes: {num_classes}")

    # ── Build matching model architecture ──────────────────────────────────
    if is_timm_vit:
        try:
            import timm
            model = timm.create_model("vit_tiny_patch16_224", pretrained=False, num_classes=num_classes)
        except ImportError:
            raise RuntimeError("Checkpoint is a timm ViT but timm is not installed. Run: pip install timm")
    elif is_torchvision:
        # Saved with torchvision.models.efficientnet_b0 (Kaggle training script)
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(
            model.classifier[1].in_features, num_classes
        )
    else:
        # Saved with efficientnet_pytorch library (legacy local training)
        try:
            from efficientnet_pytorch import EfficientNet
            model = EfficientNet.from_pretrained("efficientnet-b0")
            model._fc = nn.Linear(model._fc.in_features, num_classes)
        except ImportError:
            raise RuntimeError(
                "Checkpoint was trained with efficientnet_pytorch but it is "
                "not installed. Run: pip install efficientnet_pytorch"
            )

    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    print(f"[CLS] Model loaded successfully ({num_classes} classes).")
    return model, num_classes


# ─────────────────────────────────────────────
#  MODULE-LEVEL STATE
# ─────────────────────────────────────────────
_model: nn.Module | None = None
_num_classes: int        = 0
_class_to_idx: Dict      = {}
_idx_to_class: Dict      = {}
_folder_to_chars: Dict   = {}
_model_loaded: bool      = False


def _ensure_loaded():
    """Lazy-load everything the first time it is needed."""
    global _model, _num_classes, _class_to_idx, _idx_to_class
    global _model_loaded

    if _model_loaded:
        return

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}\n"
            "Run backend/train.py first to generate the model."
        )

    # Load class mapping (PyTorch indices to Folder names)
    with open(CLASS_IDX_PATH, "r", encoding="utf-8") as f:
        _class_to_idx = json.load(f)
    _idx_to_class = {int(v): k for k, v in _class_to_idx.items()}

    # Load Folder names to Tamil Characters mapping (if available)
    global _folder_to_chars
    if IDX_CHARS_PATH.exists():
        with open(IDX_CHARS_PATH, "r", encoding="utf-8") as f:
            # Map string folder ID to the joined string of characters
            raw_map = json.load(f)
            _folder_to_chars = {str(k): ", ".join(v) if isinstance(v, list) else v for k, v in raw_map.items()}

    # Load model
    _model, _num_classes = _load_model()
    try:
        torch.set_num_threads(1)
    except Exception:
        pass
    _model_loaded = True


def is_model_loaded() -> bool:
    """Return True if the model has been successfully loaded."""
    return _model_loaded


def get_num_classes() -> int:
    _ensure_loaded()
    return _num_classes


# ─────────────────────────────────────────────
#  INFERENCE HELPERS
# ─────────────────────────────────────────────
def _crop_to_tensor(crop: np.ndarray) -> torch.Tensor:
    """Convert a raw BGR numpy crop to a normalised tensor.
    
    This EXACTLY mirrors the logic from prepare_cleaned_dataset.py and kaggle_train.py
    to prevent domain shift. The model was trained on color images padded with white.
    """
    # 1. Resize while maintaining aspect ratio
    h, w = crop.shape[:2]
    scale = IMG_SIZE / max(h, w)
    nh, nw = int(h * scale), int(w * scale)
    
    # Handle extremely tiny or empty crops safely
    if nh == 0 or nw == 0:
        nh, nw = 1, 1
        
    resized = cv2.resize(crop, (nw, nh))
    
    # 2. Pad to square 224x224 with WHITE background
    padded = np.ones((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8) * 255
    y_offset = (IMG_SIZE - nh) // 2
    x_offset = (IMG_SIZE - nw) // 2
    padded[y_offset:y_offset+nh, x_offset:x_offset+nw] = resized
    
    # 3. Convert BGR to RGB
    rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB)
    
    # 4. Convert to PIL and apply normalization
    pil = Image.fromarray(rgb)
    return _transform(pil)



@torch.no_grad()
def classify_crop(crop: np.ndarray) -> Dict:
    """
    Classify a single BGR image crop.

    Returns
    -------
    dict
        class_id     : str        — predicted class folder name ("0" … "27")
        modern_tamil : str        — mapped modern Tamil character from label_map
        confidence   : float      — softmax confidence of top-1 prediction [0, 1]
        top3         : List[Dict] — top-3 predictions, each with class_id,
                                    modern_tamil, and confidence
    """
    _ensure_loaded()

    tensor = _crop_to_tensor(crop).unsqueeze(0).to(DEVICE)
    logits = _model(tensor)
    probs  = F.softmax(logits, dim=1)

    # Top-3 predictions
    top3_confs, top3_idxs = torch.topk(probs, k=min(3, probs.shape[1]), dim=1)

    top3 = []
    for idx, conf in zip(top3_idxs[0].tolist(), top3_confs[0].tolist()):
        folder_id = _idx_to_class.get(int(idx), str(int(idx)))
        tamil_chars = _folder_to_chars.get(folder_id, folder_id) if _folder_to_chars else folder_id
        
        top3.append({
            "class":       folder_id,
            "modern_tamil": tamil_chars,
            "confidence":  round(float(conf), 4),
        })

    # Top-1 is the first entry
    best = top3[0]

    return {
        "class_id":    best["class"],
        "modern_tamil": best["modern_tamil"],
        "confidence":  best["confidence"],
        "top3":        top3,
    }


@torch.no_grad()
def classify_batch(crops: List[np.ndarray], batch_size: int = 8) -> List[Dict]:
    """
    Classify a list of BGR image crops in mini-batches to keep memory usage low.

    Returns
    -------
    List[Dict]
        Same structure as classify_crop(), one dict per crop.
    """
    _ensure_loaded()

    if not crops:
        return []

    results = []
    # Process in batches to prevent Out of Memory errors on resource-constrained containers
    for i in range(0, len(crops), batch_size):
        batch_crops = crops[i : i + batch_size]
        tensors = torch.stack([_crop_to_tensor(c) for c in batch_crops]).to(DEVICE)
        logits  = _model(tensors)
        probs   = F.softmax(logits, dim=1)

        # Get top-3 predictions per crop
        top3_confs, top3_idxs = torch.topk(probs, k=min(3, probs.shape[1]), dim=1)

        for j in range(len(batch_crops)):
            top3 = []
            for idx, conf in zip(top3_idxs[j].tolist(), top3_confs[j].tolist()):
                folder_id = _idx_to_class.get(int(idx), str(int(idx)))
                tamil_chars = _folder_to_chars.get(folder_id, folder_id) if _folder_to_chars else folder_id
                
                top3.append({
                    "class":        folder_id,
                    "modern_tamil": tamil_chars,
                    "confidence":   round(float(conf), 4),
                })
            best = top3[0]
            results.append({
                "class_id":    best["class"],
                "modern_tamil": best["modern_tamil"],
                "confidence":  best["confidence"],
                "top3":        top3,
            })

    return results
