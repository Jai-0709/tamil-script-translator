import zipfile
from pathlib import Path

def zip_folder_for_kaggle(source_dir="dataset/yolo_master_segmentation", output_zip="yolo_master_dataset.zip"):
    """
    Compresses dataset folder into a clean POSIX-formatted .zip file compatible with Kaggle's Linux uploader.
    Replaces Windows backslashes ('\\') with POSIX forward slashes ('/') in ZIP entry names.
    """
    source_path = Path(source_dir)
    output_path = Path(output_zip)

    if not source_path.exists():
        print(f"[ERROR] Source path '{source_path}' does not exist. Run merge_roboflow_zips.py first.")
        return

    print(f"[ZIP] Compressing '{source_path}' for Kaggle dataset upload...")
    count = 0
    with zipfile.ZipFile(output_path, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
        for file_path in source_path.rglob('*'):
            if file_path.is_file():
                # Formats internal zip paths with forward slashes ('/') required by Kaggle Linux
                rel_path = file_path.relative_to(source_path).as_posix()
                zipf.write(file_path, arcname=rel_path)
                count += 1

    print("\n" + "="*70)
    print(f"[SUCCESS] Kaggle-compatible ZIP created successfully!")
    print(f"  - File Name: {output_path.name}")
    print(f"  - Full Path: {output_path.absolute()}")
    print(f"  - Total Compressed Files: {count}")
    print(f"  - Paths: POSIX Forward-Slashes ('/') - 100% Kaggle Compatible")
    print("="*70)

if __name__ == "__main__":
    zip_folder_for_kaggle()
