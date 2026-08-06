import os
import shutil
import glob
import cv2
import yaml
from pathlib import Path

def prepare_hybrid_datasets(unlabeled_dir="dataset/unlabeled_400", labeled_zips_dir="dataset/merged_roboflow", output_dir="dataset/final_hybrid"):
    """
    Processes:
    1. Unlabeled 400 images -> Converts all box labels to class 0 ('character') for YOLO Bounding Box Training.
    2. Labeled 11 ZIP datasets -> Uses exact Tamil character labels for Character Classifier Training + YOLO Bounding Box Training.
    """
    unlabeled_path = Path(unlabeled_dir)
    labeled_path = Path(labeled_zips_dir)
    output_path = Path(output_dir)
    
    yolo_dir = output_path / "yolo_dataset"
    classifier_dir = output_path / "classifier_dataset"
    
    for p in [yolo_dir / "images" / "train", yolo_dir / "images" / "val",
              yolo_dir / "labels" / "train", yolo_dir / "labels" / "val", classifier_dir]:
        p.mkdir(parents=True, exist_ok=True)
        
    print("[HYBRID DATASET] Step 1: Converting 400 Unlabeled Images for YOLO Bounding Box Training...")
    # Convert all 400 bounding box text files to class 0 ('character')
    unlabeled_lbls = list(unlabeled_path.glob("**/*.txt"))
    for lbl_file in unlabeled_lbls:
        if lbl_file.name == "data.yaml": continue
        with open(lbl_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Override class index to 0
        new_lines = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 5:
                parts[0] = "0"
                new_lines.append(" ".join(parts) + "\n")
                
        out_lbl = yolo_dir / "labels" / "train" / f"unlabeled_{lbl_file.name}"
        with open(out_lbl, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
            
        # Copy matching image
        img_name = lbl_file.stem
        for ext in ['.jpg', '.jpeg', '.png', '.bmp']:
            img_file = lbl_file.parent / f"{img_name}{ext}"
            if not img_file.exists():
                img_file = lbl_file.parent / "images" / f"{img_name}{ext}"
            if img_file.exists():
                shutil.copy(img_file, yolo_dir / "images" / "train" / f"unlabeled_{img_file.name}")
                break

    print("[HYBRID DATASET] Step 2: Extracting Character Crops from 11 Labeled ZIP Datasets for ResNet Classifier...")
    # Parse data.yaml from labeled Roboflow datasets
    yaml_file = labeled_path / "data.yaml"
    class_map = {}
    if yaml_file.exists():
        with open(yaml_file, 'r', encoding='utf-8') as f:
            d_info = yaml.safe_load(f)
            class_map = d_info.get('names', {})
            
    # Extract crops for each labeled character box
    lbl_files = list(labeled_path.glob("**/*.txt"))
    crops_count = 0
    for lbl_file in lbl_files:
        if lbl_file.name == "data.yaml": continue
        img_stem = lbl_file.stem
        img_file = None
        for ext in ['.jpg', '.jpeg', '.png', '.bmp']:
            test_path = lbl_file.parent.parent / "images" / f"{img_stem}{ext}"
            if test_path.exists():
                img_file = test_path
                break
        if not img_file: continue
        
        img = cv2.imread(str(img_file))
        if img is None: continue
        h, w = img.shape[:2]
        
        with open(lbl_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        for line_idx, line in enumerate(lines):
            parts = line.strip().split()
            if len(parts) >= 5:
                cls_id = int(parts[0])
                char_name = class_map.get(cls_id, f"char_{cls_id}")
                
                # Convert normalized YOLO bbox to pixel coords
                cx, cy, bw, bh = [float(v) for v in parts[1:5]]
                bx = max(0, int((cx - bw / 2.0) * w))
                by = max(0, int((cy - bh / 2.0) * h))
                bw_px = min(w - bx, int(bw * w))
                bh_px = min(h - by, int(bh * h))
                
                if bw_px > 5 and bh_px > 5:
                    crop = img[by:by+bh_px, bx:bx+bw_px]
                    if crop.size > 0:
                        char_folder = classifier_dir / str(char_name)
                        char_folder.mkdir(parents=True, exist_ok=True)
                        crop_filename = f"{img_stem}_crop_{line_idx}.jpg"
                        cv2.imwrite(str(char_folder / crop_filename), crop)
                        crops_count += 1

    print("="*60)
    print(f"[SUCCESS] Hybrid Dataset Ready!")
    print(f"  - YOLO Bounding Box Training Data: {len(list((yolo_dir/'images'/'train').glob('*')))} Images")
    print(f"  - Classifier Training Data: {crops_count} Cropped Tamil Character Images across {len(list(classifier_dir.glob('*')))} unique classes")
    print("="*60)

if __name__ == "__main__":
    prepare_hybrid_datasets()
