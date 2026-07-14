import cv2
import os
import glob
from pathlib import Path

# Configuration
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
INPUT_DIR = str(ROOT_DIR / "data" / "raw_images")       # Folder containing your large inscription images
OUTPUT_DIR = str(ROOT_DIR / "data" / "yolo_dataset")    # Folder where sliced 640x640 images will be saved
TILE_SIZE = 640
OVERLAP = 100                  # Overlap between tiles so characters aren't cut in half

def slice_image(image_path, output_dir):
    img = cv2.imread(image_path)
    if img is None:
        print(f"Failed to load {image_path}")
        return

    h, w, _ = img.shape
    base_name = Path(image_path).stem

    count = 0
    for y in range(0, h, TILE_SIZE - OVERLAP):
        for x in range(0, w, TILE_SIZE - OVERLAP):
            # Ensure we don't go out of bounds
            y2 = min(y + TILE_SIZE, h)
            x2 = min(x + TILE_SIZE, w)
            y1 = max(0, y2 - TILE_SIZE)
            x1 = max(0, x2 - TILE_SIZE)

            tile = img[y1:y2, x1:x2]

            tile_filename = os.path.join(output_dir, f"{base_name}_tile_{count}.jpg")
            cv2.imwrite(tile_filename, tile)
            count += 1

    print(f"Sliced {base_name} into {count} tiles.")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(INPUT_DIR, exist_ok=True)

    image_paths = []
    for ext in ('*.jpg', '*.jpeg', '*.png'):
        image_paths.extend(glob.glob(os.path.join(INPUT_DIR, ext)))

    if not image_paths:
        print(f"No images found in '{INPUT_DIR}'.")
        print(f"Please put your full-size inscription images in the '{INPUT_DIR}' folder.")
        return

    print(f"Found {len(image_paths)} images to slice. Slicing to {TILE_SIZE}x{TILE_SIZE} with {OVERLAP}px overlap...")
    
    for path in image_paths:
        slice_image(path, OUTPUT_DIR)

    print("\nDone! You can now upload the images in the 'yolo_dataset' folder to Roboflow for annotation.")

if __name__ == "__main__":
    main()
