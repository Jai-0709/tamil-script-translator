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
def _load_model():
    ckpt  = torch.load(str(MODEL_PATH), map_location="cpu", weights_only=False)
    state = ckpt.get("model_state_dict", ckpt)

    # ── Detect architecture by inspecting checkpoint keys ──────────────────
    # torchvision EfficientNet uses "features.*" / "classifier.*"
    # efficientnet_pytorch uses "_conv_stem.*" / "_fc.*"
    is_torchvision = any(k.startswith("features.") for k in state.keys())

    # ── Infer num_classes from checkpoint ──────────────────────────────────
    if "num_classes" in ckpt:
        num_classes = ckpt["num_classes"]
    elif is_torchvision and "classifier.1.weight" in state:
        num_classes = state["classifier.1.weight"].shape[0]
    elif not is_torchvision and "_fc.weight" in state:
        num_classes = state["_fc.weight"].shape[0]
    else:
        raise KeyError("Cannot infer num_classes from checkpoint.")

    print(f"[CLS] Checkpoint format: {'torchvision' if is_torchvision else 'efficientnet_pytorch'}")
    print(f"[CLS] num_classes: {num_classes}")

    # ── Build matching model architecture ──────────────────────────────────
    if is_torchvision:
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

    # Load class mapping
    with open(CLASS_IDX_PATH, "r", encoding="utf-8") as f:
        _class_to_idx = json.load(f)
    _idx_to_class = {int(v): k for k, v in _class_to_idx.items()}

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
def _preprocess_crop_for_classification(crop: np.ndarray) -> np.ndarray:
    """
    Preprocess a BGR inscription crop before classification.

    Real inscription crops contain:
    - Stone texture noise (grain, cracks)
    - Uneven illumination across the carved area
    - Low contrast between character groove and surrounding stone

    This function normalizes all of these so the model sees a clean,
    consistent character shape regardless of stone quality.

    Returns a BGR image ready for PIL conversion.
    """
    # Ensure minimum size for processing
    h, w = crop.shape[:2]
    if h < 4 or w < 4:
        return crop

    # Convert to grayscale for processing
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # 1. Denoise — remove stone grain while keeping character edges
    denoised = cv2.fastNlMeansDenoising(gray, h=12, templateWindowSize=7, searchWindowSize=21)

    # 2. CLAHE — boost local contrast (handles uneven lighting on stone surface)
    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(4, 4))
    enhanced = clahe.apply(denoised)

    # 3. Adaptive threshold → clean binary character mask
    #    blockSize must be odd and > 1; clamp to valid range
    block = max(11, (min(h, w) // 4) | 1)   # odd number, at least 11
    binary = cv2.adaptiveThreshold(
        enhanced, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=block, C=8
    )

    # 4. Small morphological cleanup (remove noise dots)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k, iterations=1)

    # 5. Detect foreground ratio — if nearly empty, fall back to raw enhanced gray
    fg_ratio = cv2.countNonZero(binary) / max(binary.size, 1)
    if fg_ratio < 0.02 or fg_ratio > 0.85:
        # Fallback: just use CLAHE-enhanced grayscale (inverted so char=bright)
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 6. Convert binary mask back to 3-channel BGR (white char on black bg)
    #    The model was trained on grayscale characters converted to 3-channel
    bgr_out = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    return bgr_out


def _crop_to_tensor(crop: np.ndarray) -> torch.Tensor:
    """Convert a BGR numpy crop to a normalised tensor.

    Pipeline: BGR → inscription-aware preprocess → RGB (PIL) →
              grayscale → 3-channel → resize 224×224 → ToTensor → normalize
    """
    # Apply inscription-aware preprocessing to clean up stone texture
    processed = _preprocess_crop_for_classification(crop)
    pil = Image.fromarray(processed[..., ::-1])   # BGR → RGB
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
            "modern_tamil": cid,
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
                cid = _idx_to_class.get(int(idx), str(int(idx)))
                top3.append({
                    "class":        cid,
                    "modern_tamil": cid,
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
