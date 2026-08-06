import os
import zipfile
import shutil
import glob
import yaml
from pathlib import Path

def merge_all_for_yolo_segmentation(
    zips_dir="raw_zips",
    output_dir="dataset/yolo_master_segmentation"
):
    """
    Merges ALL datasets (the 400-image Roboflow ZIP + the 11 junior Roboflow ZIP files)
    placed in raw_zips/ strictly for YOLO Segmentation Training.
    Strips all character labels and converts all bounding boxes to class 0 ('character').
    """
    zips_dir = Path(zips_dir)
    output_dir = Path(output_dir)
    
    images_train = output_dir / "images" / "train"
    images_val   = output_dir / "images" / "val"
    labels_train = output_dir / "labels" / "train"
    labels_val   = output_dir / "labels" / "val"
    
    for p in [images_train, images_val, labels_train, labels_val]:
        p.mkdir(parents=True, exist_ok=True)
        
    total_images_merged = 0
    total_bboxes = 0

    if not zips_dir.exists():
        zips_dir.mkdir(parents=True, exist_ok=True)
        print(f"[INFO] Created '{zips_dir}' folder. Please drop all your Roboflow ZIP exports inside it.")
        return

    zip_files = list(zips_dir.glob("*.zip"))
    if not zip_files:
        print(f"[ERROR] No .zip files found in '{zips_dir}'. Place your Roboflow ZIP exports there.")
        return

    print(f"\n[MERGE] Found {len(zip_files)} Roboflow dataset ZIP exports to merge for YOLO Segmentation...")
    
    for idx, zip_path in enumerate(zip_files, 1):
        prefix = f"ds{idx}_"
        temp_extract = output_dir / f"temp_{idx}"
        print(f"[MERGE {idx}/{len(zip_files)}] Unpacking {zip_path.name}...")
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_extract)
            
        for split in ['train', 'valid', 'val']:
            img_src = temp_extract / split / "images"
            lbl_src = temp_extract / split / "labels"
            
            if not img_src.exists():
                img_src = temp_extract / "images"
                lbl_src = temp_extract / "labels"
                
            if img_src.exists():
                target_img_dir = images_val if split in ['valid', 'val'] else images_train
                target_lbl_dir = labels_val if split in ['valid', 'val'] else labels_train
                
                for img_file in img_src.glob("*.*"):
                    if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                        new_name = f"{prefix}{img_file.name}"
                        shutil.copy(img_file, target_img_dir / new_name)
                        total_images_merged += 1
                        
                        lbl_file = lbl_src / f"{img_file.stem}.txt"
                        if lbl_file.exists():
                            with open(lbl_file, 'r', encoding='utf-8') as f:
                                lines = f.readlines()
                            new_lines = []
                            for line in lines:
                                parts = line.strip().split()
                                if len(parts) >= 5:
                                    parts[0] = "0"  # Class 0: 'character'
                                    new_lines.append(" ".join(parts) + "\n")
                                    total_bboxes += 1
                            with open(target_lbl_dir / f"{prefix}{img_file.stem}.txt", 'w', encoding='utf-8') as f:
                                f.writelines(new_lines)

        shutil.rmtree(temp_extract, ignore_errors=True)

    # Master data.yaml
    merged_yaml = {
        'path': str(output_dir.absolute()),
        'train': 'images/train',
        'val': 'images/val',
        'names': {0: 'character'}
    }
    
    with open(output_dir / "data.yaml", 'w', encoding='utf-8') as f:
        yaml.dump(merged_yaml, f, allow_unicode=True)

    print("\n" + "="*70)
    print(f"[SUCCESS] Master Segmentation Dataset Created Successfully!")
    print(f"  - Total ZIP Files Merged: {len(zip_files)}")
    print(f"  - Total Images Merged: {total_images_merged}")
    print(f"  - Total Bounding Boxes: {total_bboxes}")
    print(f"  - Master Dataset Path: {output_dir}")
    print("="*70)

if __name__ == "__main__":
    merge_all_for_yolo_segmentation()
