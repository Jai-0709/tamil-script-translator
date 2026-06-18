# Ancient Tamil Inscription Translator: Project Overview & Documentation

This document provides a comprehensive breakdown of the project architecture, full tech stack, current development progress, and a step-by-step explanation of how the system segments, detects, and translates ancient Tamil inscriptions.

---

## 🛠️ Tech Stack & Architecture

The project is structured as a full-stack web application with dedicated modules for machine learning training, computer vision segmentation, and inference.

### Frontend
- **Framework:** React 18.3 (Single Page Application)
- **Build Tool:** Vite 5.3 (Fast Dev Server & HMR)
- **Styling:** Tailwind CSS v4.0 (Modern utility-first CSS integration)
- **HTTP Client:** Axios (API communication with backend)

### Backend
- **Framework:** FastAPI (Python web framework for high-performance async APIs)
- **Web Server:** Uvicorn (ASGI web server implementation)
- **Image Processing & Computer Vision:** OpenCV (cv2), Pillow (PIL), NumPy
- **Deep Learning Framework:** PyTorch & Torchvision
- **Augmentation Library:** Albumentations (for robust retraining simulations)

### Directory Structure
```
TAMIL SCRIPT VERSION 2/
├── backend/                  # FastAPI App, Segmentation & Retraining Scripts
│   ├── main.py               # REST API endpoints & route orchestration
│   ├── segmentation.py       # Custom OpenCV line & character segmentation pipeline
│   ├── classifier.py         # PyTorch inference controller (loads model, runs prediction)
│   ├── retrain_robust.py     # Heavy augmentation fine-tuning script
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React UI Client
│   ├── src/                  # Components (UploadZone, TranslationPanel, etc.)
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite configurations
├── models/                   # Neural network checkpoints & class maps
│   ├── ancient_tamil_classifier.pth  # Fine-tuned PyTorch Model weights
│   ├── class_to_idx.json     # Class folders ("0"–"27") to model index mapping
│   └── label_map.json        # Class IDs mapped to modern Tamil unicode output
├── setup.bat                 # One-click developer setup batch script
├── run_backend.bat           # Starts the backend FastAPI server
└── run_frontend.bat           # Starts the React UI dev server
```

---

## 🔍 Process: How the System Finds & Detects Characters

The translation process goes from raw stone slab photos to modern Tamil strings. This relies on an advanced, adaptive image segmentation pipeline defined in [`backend/segmentation.py`](file:///e:/TAMIL%20SCRIPT%20VERSION%202/backend/segmentation.py).

Below is the step-by-step pipeline of **how it finds the words/characters**:

1. **Image Normalization & Resizing:**
   The input image is downscaled to a maximum width of `1200px` (preserving aspect ratio) to normalize processing times and kernel sizing. Height and width scaling ratios (`sx_orig`, `sy_orig`) are recorded to accurately crop segments from the original high-resolution image later.

2. **Color Inversion:**
   The resized image is converted to grayscale, and the colors are inverted (`cv2.bitwise_not`). Since ancient characters are carved (grooved), this step turns the character strokes into bright foreground details and the stone surface into a dark background.

3. **Texture Noise Elimination (Blur + CLAHE):**
   - **Strong Gaussian Blur:** A large `(21, 21)` Gaussian filter is applied. This is critical for stone inscriptions to blur out high-frequency stone grain texture and micro-cracks while keeping overall character strokes intact.
   - **CLAHE:** Contrast Limited Adaptive Histogram Equalization is applied with a clip limit of `3.0` and tile grid size of `(8, 8)` to enhance local contrast, revealing faint carvings.

4. **Adaptive Multi-Thresholding:**
   Binary thresholding is performed. The pipeline starts with a default threshold of `127`. To handle uneven lighting or background textures flooding the output, the code checks the foreground density (`fg_pct`):
   - If foreground > `40%`, threshold increases to `150`.
   - If foreground > `60%`, threshold increases to `170`.

5. **Border Rejection & Morphological Opening:**
   An outer margin (proportional to image size) is blanked to zero to eliminate slab edges or crop artifacts. A morphological opening (2 iterations, `3x3` ellipse kernel) is performed to clear tiny isolated specs of thresholded noise.

6. **Horizontal Letter Dilation:**
   The clean binary image is dilated using a custom rectangular kernel (e.g., `6x2` or `5x2` depending on width). Dilating wider than taller ensures letters adjacent on the same line merge into readable bounding boxes without fusing vertical lines of text together.

7. **Contour Filtering & Overlap Removal:**
   - Contours are identified via `cv2.findContours`. Bounding boxes are filtered by aspect ratio, area, and size constraints. Exceptionally wide, tall, or tiny bounding boxes are rejected.
   - **Overlap Resolution:** If multiple bounding boxes overlap by more than `30%`, the smaller dominated boxes are dropped to prevent multiple boxes on the same character.

8. **Y-Center Line Sorting (Reading Order):**
   Remaining character boxes are sorted vertically based on their center-Y coordinates. Using a `35px` center tolerance, the boxes are grouped into lines. Within each line, boxes are sorted from left to right (X coordinate) to match standard Tamil reading order.

9. **Final Original-Resolution Crop:**
   The workspace coordinates are scaled back using the original ratios. The original color image is cropped at these exact boundaries and passed directly to the batch classifier.

---

## 🧠 Model Classification & Post-Processing

Once individual character crops are extracted, they are run through the classification model:

1. **Preprocessing:**
   The cropped BGR image is converted to RGB (PIL), converted to grayscale, cloned to 3 channels, resized to `224x224`, and normalized using standard ImageNet mean/std values.

2. **Inference:**
   The image tensor goes through an **EfficientNet-B0** network (capable of classifying 28 classes).

3. **Top-3 Prediction Output:**
   The API fetches both the primary top-1 character class and the **top-3** candidate classes with their respective confidences.
   Example JSON output:
   ```json
   {
     "class_id": "0",
     "modern_tamil": "க",
     "confidence": 0.845,
     "top3": [
       {"class": "0", "modern_tamil": "க", "confidence": 0.845},
       {"class": "1", "modern_tamil": "ர", "confidence": 0.112},
       {"class": "3", "modern_tamil": "ன", "confidence": 0.043}
     ]
   }
   ```

4. **Sentence Reconstruction:**
   The backend joins the top predicted characters line-by-line using double spaces to separate words, forming the final modern Tamil output.

---

## 🏆 Development Milestones & Improvements

Here is a summary of what has been implemented and enhanced:

### 1. One-Click Setup & Startup
- Developer setup is streamlined with `setup.bat`. It creates the Python virtual environment (`venv`), installs requirements, and runs `npm install` in the frontend.
- Launching the app is simplified via double-clickable batch files (`run_backend.bat`, `run_frontend.bat`).

### 2. Batch Classification Endpoint
- Modified the FastAPI endpoint (`POST /translate`) to extract all bounding boxes, stack them, and send them through a single batch forwarding pass in PyTorch. This reduced translation times from seconds to milliseconds.

### 3. Top-3 Prediction Results
- Enhanced the `classifier.py` script to return top-3 candidate classes. This gives frontend users alternative choices if the top-1 prediction is wrong due to severe slab wear.

### 4. Robust Retraining Script (`retrain_robust.py`)
- **The Problem:** The initial model trained on clean, clear script crops had very low confidence (5%-18%) when exposed to real-world stone crops.
- **The Solution:** Implemented `retrain_robust.py` to fine-tune the existing weights using heavy augmentations with **Albumentations**. The pipeline simulates stone damage, texture, shadows, and low resolution using:
  - `GaussNoise` & `ISONoise` (simulating sensor noise on carvings).
  - `MotionBlur`, `GaussianBlur`, & `MedianBlur` (simulating unfocused camera crops).
  - `ElasticTransform`, `GridDistortion` & `OpticalDistortion` (simulating natural surface curvature/warp).
  - `CoarseDropout` (simulating missing pieces of chipped stone).
  - `Sharpen` & `Emboss` (simulating high-contrast lighting/embossed carvings).
  - AdamW optimizer with a low learning rate (`5e-5`), scheduler `CosineAnnealingLR` (T_max=30) for `30` epochs.
