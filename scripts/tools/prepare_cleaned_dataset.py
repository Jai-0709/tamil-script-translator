import os
import cv2
import json
import shutil
from pathlib import Path

# ─────────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
INPUT_DIR = BASE_DIR / "CLEANED DATA SET"
OUTPUT_DIR = BASE_DIR / "dataset" / "classification" / "train"
MODELS_DIR = BASE_DIR / "models"

CLASS_IDX_PATH = MODELS_DIR / "class_to_idx.json"
IDX_CHARS_PATH = MODELS_DIR / "idx_to_chars.json"

IMG_SIZE = 128

def prepare_dataset():
    if not INPUT_DIR.exists():
        print(f"[ERROR] Input directory not found: {INPUT_DIR}")
        return

    # Clear output directory if it exists
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    class_to_idx = {}
    idx_to_chars = {}
    
    # Sort folders to ensure deterministic ID assignment
    folders = sorted([d for d in INPUT_DIR.iterdir() if d.is_dir()])
    
    print(f"[INFO] Found {len(folders)} classes in CLEANED DATA SET.")
    
    for idx, folder in enumerate(folders):
        folder_name = folder.name
        class_to_idx[folder_name] = idx
        
        # Parse the comma-separated characters
        # e.g., "மு, ழு, மூ, ழூ" -> ["மு", "ழு", "மூ", "ழூ"]
        chars = [c.strip() for c in folder_name.replace(' ', '').split(',')]
        idx_to_chars[idx] = chars
        
        # Create output directory for this class ID
        out_class_dir = OUTPUT_DIR / str(idx)
        out_class_dir.mkdir(parents=True)
        
        # Copy and resize images
        images = list(folder.glob("*.jpg")) + list(folder.glob("*.png")) + list(folder.glob("*.jpeg"))
        
        print(f"Processing Class {idx:03d}: {len(images)} images...", end="\r")
        
        for i, img_path in enumerate(images):
            try:
                # OpenCV imread fails on Windows with Unicode (Tamil) file paths.
                # Use imdecode instead.
                with open(img_path, "rb") as f:
                    img_array = np.asarray(bytearray(f.read()), dtype=np.uint8)
                    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                    
                if img is None: continue
                
                # Resize and pad to square IMG_SIZE
                h, w = img.shape[:2]
                scale = IMG_SIZE / max(h, w)
                nh, nw = int(h * scale), int(w * scale)
                img_resized = cv2.resize(img, (nw, nh))
                
                # Pad to square
                padded = np.ones((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8) * 255 # White background
                y_offset = (IMG_SIZE - nh) // 2
                x_offset = (IMG_SIZE - nw) // 2
                padded[y_offset:y_offset+nh, x_offset:x_offset+nw] = img_resized
                
                out_img_path = out_class_dir / f"{idx}_{i:04d}.jpg"
                cv2.imwrite(str(out_img_path), padded)
            except Exception as e:
                print(f"\n[ERROR] Failed to process {img_path}: {e}")
                
    print(f"\n[INFO] Finished processing {len(folders)} classes.")
    
    # Save mapping files
    with open(CLASS_IDX_PATH, "w", encoding="utf-8") as f:
        json.dump(class_to_idx, f, ensure_ascii=False, indent=2)
    print(f"[INFO] Saved class_to_idx.json to {CLASS_IDX_PATH}")
        
    with open(IDX_CHARS_PATH, "w", encoding="utf-8") as f:
        json.dump(idx_to_chars, f, ensure_ascii=False, indent=2)
    print(f"[INFO] Saved idx_to_chars.json to {IDX_CHARS_PATH}")

if __name__ == "__main__":
    import numpy as np # import inside because I forgot at the top
    prepare_dataset()
