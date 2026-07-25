import os
import cv2
import json
import uuid
import argparse
from pathlib import Path

# ─────────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATASET_DIR = BASE_DIR / "CLEANED DATA SET"

def import_corrections(image_path: str, json_path: str):
    image_path = Path(image_path)
    json_path = Path(json_path)

    if not image_path.exists():
        print(f"[ERROR] Image not found: {image_path}")
        return
    if not json_path.exists():
        print(f"[ERROR] JSON not found: {json_path}")
        return

    # Load image using OpenCV (handle unicode paths safely)
    with open(image_path, "rb") as f:
        import numpy as np
        img_array = np.asarray(bytearray(f.read()), dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if img is None:
        print(f"[ERROR] Failed to load image: {image_path}")
        return

    # Load JSON
    with open(json_path, "r", encoding="utf-8") as f:
        corrections = json.load(f)

    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    
    success_count = 0
    for item in corrections:
        # We only want to add the characters the user explicitly corrected, 
        # because those are the hard examples the AI failed on!
        if not item.get("was_corrected", False):
            continue
            
        tamil_char = item["corrected"].strip()
        if not tamil_char:
            continue
            
        # Find the correct folder in the dataset
        # In CLEANED DATA SET, folders often have comma-separated values like "மு, ழு, மூ, ழூ"
        # We need to find the folder that contains this specific tamil_char
        target_folder = None
        if DATASET_DIR.exists():
            for folder in DATASET_DIR.iterdir():
                if not folder.is_dir():
                    continue
                folder_chars = [c.strip() for c in folder.name.replace(' ', '').split(',')]
                if tamil_char in folder_chars:
                    target_folder = folder
                    break
        
        # If the folder doesn't exist (e.g. brand new character), create a new folder for it!
        if target_folder is None:
            target_folder = DATASET_DIR / tamil_char
            target_folder.mkdir(parents=True, exist_ok=True)
            print(f"[INFO] Created new dataset class folder for: {tamil_char}")

        # Crop the image
        x, y, w, h = item["x"], item["y"], item["w"], item["h"]
        
        # Add a tiny bit of padding (5%) so the character isn't perfectly touching the crop edge
        px = max(0, int(w * 0.05))
        py = max(0, int(h * 0.05))
        
        y1 = max(0, y - py)
        y2 = min(img.shape[0], y + h + py)
        x1 = max(0, x - px)
        x2 = min(img.shape[1], x + w + px)

        crop = img[y1:y2, x1:x2]
        if crop.size == 0:
            continue
            
        # Generate a unique random filename to prevent overwriting
        unique_id = uuid.uuid4().hex[:8]
        out_filename = target_folder / f"correction_{unique_id}.jpg"
        
        # Save crop safely
        success = cv2.imencode('.jpg', crop)[1].tofile(str(out_filename))
        if success:
            success_count += 1
            print(f"[SUCCESS] Saved '{tamil_char}' -> {out_filename.relative_to(BASE_DIR)}")

    print(f"\n[DONE] Successfully imported {success_count} new training images to your CLEANED DATA SET!")
    print("       You can now run 'python scripts/tools/prepare_cleaned_dataset.py' to format them,")
    print("       and then 'python scripts/training/retrain_robust.py' to make the AI smarter!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import UI Corrections to Dataset")
    parser.add_argument("image", help="Path to the original stone inscription image")
    parser.add_argument("json", help="Path to the downloaded corrections.json file")
    
    args = parser.parse_args()
    import_corrections(args.image, args.json)
