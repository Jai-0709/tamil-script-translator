# ==============================================================================
# KAGGLE GPU YOLOv11/YOLOv8 SEGMENTATION TRAINING SCRIPT (AUTO-VAL FIX)
# ==============================================================================

import os
import shutil
import zipfile
import random
from pathlib import Path

# 1. Install Ultralytics
os.system("pip install -q ultralytics")

from ultralytics import YOLO

# 2. Locate and extract uploaded dataset from Kaggle input
input_dir = Path("/kaggle/input")
work_dir = Path("/kaggle/working/yolo_data")
work_dir.mkdir(parents=True, exist_ok=True)

zip_files = list(input_dir.glob("**/*.zip"))
if zip_files:
    print(f"[INFO] Extracting {zip_files[0].name} to {work_dir}...")
    with zipfile.ZipFile(zip_files[0], 'r') as z:
        z.extractall(work_dir)
else:
    for p in input_dir.rglob("images"):
        if p.is_dir():
            shutil.copytree(p.parent, work_dir, dirs_exist_ok=True)
            break

# Resolve base data folder if nested inside zip
nested_imgs = list(work_dir.rglob("images"))
base_data = nested_imgs[0].parent if nested_imgs else work_dir

img_train = base_data / "images" / "train"
img_val   = base_data / "images" / "val"
lbl_train = base_data / "labels" / "train"
lbl_val   = base_data / "labels" / "val"

img_train.mkdir(parents=True, exist_ok=True)
img_val.mkdir(parents=True, exist_ok=True)
lbl_train.mkdir(parents=True, exist_ok=True)
lbl_val.mkdir(parents=True, exist_ok=True)

# Auto-fix: Split 15% from train to val if val is empty
val_images = list(img_val.glob("*.*"))
train_images = list(img_train.glob("*.*"))

if not val_images and train_images:
    print(f"[INFO] 'images/val' is empty. Automatically splitting 15% from train ({len(train_images)} images)...")
    val_count = max(1, int(len(train_images) * 0.15))
    sampled_val = random.sample(train_images, val_count)
    for img_p in sampled_val:
        dest_img = img_val / img_p.name
        shutil.move(img_p, dest_img)
        lbl_p = lbl_train / f"{img_p.stem}.txt"
        if lbl_p.exists():
            shutil.move(lbl_p, lbl_val / lbl_p.name)

# 3. Build data.yaml
yaml_content = f"""
path: {base_data.absolute()}
train: images/train
val: images/val
names:
  0: character
"""

data_yaml_path = base_data / "data.yaml"
with open(data_yaml_path, 'w', encoding='utf-8') as f:
    f.write(yaml_content.strip())

print(f"[INFO] Base Dataset Path: {base_data.absolute()}")
print(f"[INFO] Train Images: {len(list(img_train.glob('*.*')))}")
print(f"[INFO] Val Images:   {len(list(img_val.glob('*.*')))}")
print(f"[INFO] data.yaml:   {data_yaml_path}")

# 4. Initialize YOLO model (YOLOv8m transfer learning)
model = YOLO('yolov8m.pt')

# 5. Train YOLO on Kaggle T4 GPU for 100 Epochs
print("\n[START] Starting YOLO Segmentation Training on Kaggle T4 GPU (100 Epochs)...")
results = model.train(
    data=str(data_yaml_path),
    epochs=100,
    imgsz=640,
    batch=16,
    workers=4,
    device=0,
    project='/kaggle/working/runs',
    name='yolo_tamil_segmentation',
    save=True,
    exist_ok=True
)

print("\n" + "="*70)
print("[SUCCESS] Training Complete!")
print("Your trained model weights are saved at:")
print("  -> /kaggle/working/runs/yolo_tamil_segmentation/weights/best.pt")
print("="*70)
