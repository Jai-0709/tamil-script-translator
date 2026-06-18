"""
Ancient Tamil Inscription Translator — Classifier Module
Loads the trained EfficientNet-B0 model at import time and exposes
classify_crop() and classify_batch() functions.
"""

import json
import warnings
from pathlib import Path
from typing import Dict, List

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
LABEL_MAP_PATH = _MODELS_DIR / "label_map.json"

DEVICE   = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE = 224

# ─────────────────────────────────────────────
#  PREPROCESSING TRANSFORM
# ─────────────────────────────────────────────
_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# ─────────────────────────────────────────────
#  MODEL LOADING (at import time)
# ─────────────────────────────────────────────
def _load_model() -> nn.Module:
    ckpt  = torch.load(str(MODEL_PATH), map_location="cpu")
    state = ckpt.get("model_state_dict", ckpt)

    # Infer num_classes from checkpoint
    if "num_classes" in ckpt:
        num_classes = ckpt["num_classes"]
    elif "_fc.weight" in state:
        num_classes = state["_fc.weight"].shape[0]
    elif "classifier.1.weight" in state:
        num_classes = state["classifier.1.weight"].shape[0]
    else:
        raise KeyError("Cannot infer num_classes from checkpoint.")

    try:
        from efficientnet_pytorch import EfficientNet
        model = EfficientNet.from_pretrained("efficientnet-b0")
        model._fc = nn.Linear(model._fc.in_features, num_classes)
    except ImportError:
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(
            model.classifier[1].in_features, num_classes
        )

    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    return model, num_classes


# ─────────────────────────────────────────────
#  MODULE-LEVEL STATE
# ─────────────────────────────────────────────
_model: nn.Module | None = None
_num_classes: int        = 0
_class_to_idx: Dict      = {}
_idx_to_class: Dict      = {}
_label_map: Dict         = {}
_model_loaded: bool      = False


def _ensure_loaded():
    """Lazy-load everything the first time it is needed."""
    global _model, _num_classes, _class_to_idx, _idx_to_class
    global _label_map, _model_loaded

    if _model_loaded:
        return

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}\n"
            "Run backend/train.py first to generate the model."
        )

    # Load class mapping
    with open(CLASS_IDX_PATH, "r", encoding="utf-8") as f:
        _class_to_idx = json.load(f)
    _idx_to_class = {int(v): k for k, v in _class_to_idx.items()}

    # Load label map (class_id → modern Tamil character)
    if LABEL_MAP_PATH.exists():
        with open(LABEL_MAP_PATH, "r", encoding="utf-8") as f:
            _label_map = json.load(f)
    else:
        # Fallback: label_map is identity
        _label_map = {k: k for k in _class_to_idx}

    # Load model
    _model, _num_classes = _load_model()
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
    """Convert a BGR numpy crop to a normalised tensor.

    Pipeline: BGR → RGB (PIL) → grayscale → 3-channel → resize 224×224
              → ToTensor → ImageNet normalize
    """
    pil = Image.fromarray(crop[..., ::-1])   # BGR → RGB
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
        cid = _idx_to_class.get(int(idx), str(int(idx)))
        top3.append({
            "class":       cid,
            "modern_tamil": _label_map.get(cid, cid),
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
def classify_batch(crops: List[np.ndarray]) -> List[Dict]:
    """
    Classify a list of BGR image crops in a single forward pass.

    Returns
    -------
    List[Dict]
        Same structure as classify_crop(), one dict per crop.
    """
    _ensure_loaded()

    if not crops:
        return []

    tensors = torch.stack([_crop_to_tensor(c) for c in crops]).to(DEVICE)
    logits  = _model(tensors)
    probs   = F.softmax(logits, dim=1)
    confs, pred_idxs = probs.max(dim=1)

    results = []
    for pred_idx, conf in zip(pred_idxs.tolist(), confs.tolist()):
        class_id_str = _idx_to_class.get(int(pred_idx), str(int(pred_idx)))
        modern_tamil = _label_map.get(class_id_str, class_id_str)
        results.append({
            "class_id":    class_id_str,
            "modern_tamil": modern_tamil,
            "confidence":  round(float(conf), 4),
        })

    return results
