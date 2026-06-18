# Ancient Tamil Inscription Translator

## Overview
This project is an image classification pipeline designed to translate ancient Tamil script images into modern Tamil script equivalents. It allows users to upload photos of ancient inscriptions or historical artifacts and translates them to recognize modern Tamil characters.

## How it Works
The system works through an integrated pipeline consisting of a machine learning model, a backend API, and a frontend user interface.

1. **Dataset & Classification:** The dataset consists of 28 ancient Tamil character classes (0 to 27) which map directly to 27 modern Tamil character classes (0 to 26). Class 27 is designated as an "unknown" or "other" category.
2. **Model:** A classification model (CNN, ResNet, or Custom OCR) trained on `images_categorised/` and `augmented_images/` identifies the ancient characters and maps them to their modern string equivalents using `models/label_map.json`.
3. **Backend:** A FastAPI backend receives an uploaded ancient script image, preprocesses it to match the training dimensions, performs inference via the trained model, and returns the corresponding modern character.
4. **Frontend:** A React web interface where users can interact with the translator, upload images, and visualize the recognized modern Tamil script.

## How to Setup and Start

### 1. One-Time Setup

**Option A: Using Batch Script (Windows)**
To set up the project dependencies for the first time, simply double-click **`setup.bat`** in the project root directory. This script will automatically create the virtual environment and install both Python and Node.js dependencies.

**Option B: Using the Terminal**
If you prefer using the terminal, run the following commands from the project root:

1. Create and activate a virtual environment:
   ```cmd
   python -m venv venv
   venv\Scripts\activate
   ```
2. Install backend dependencies:
   ```cmd
   pip install -r backend\requirements.txt
   ```
3. Install frontend dependencies *(Ensure you have Node.js installed)*:
   ```cmd
   cd frontend
   npm install
   cd ..
   ```

### 2. Starting the Application
You will need to run both the backend server and the frontend development server simultaneously.

**Start the Backend API:**

*Option A: Batch Script*
Double-click **`run_backend.bat`**.

*Option B: Terminal*
```cmd
venv\Scripts\activate
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- API URL: `http://localhost:8000`
- API Documentation (Swagger UI): `http://localhost:8000/docs`

**Start the Frontend UI:**

*Option A: Batch Script*
Double-click **`run_frontend.bat`**.

*Option B: Terminal*
```cmd
cd frontend
npm run dev
```
- Web UI URL: `http://localhost:5173`

Open `http://localhost:5173` in your browser to use the application!

## Additional Utilities

You can also run the following commands from the command prompt (ensure the virtual environment is activated by running `venv\Scripts\activate`):

- **Train the Model:**
  ```cmd
  python backend\train.py
  ```

- **Test the Pipeline with a Specific Image:**
  ```cmd
  python test_pipeline.py --image "path\to\inscription.jpg"
  ```

- **Check Dataset Integrity:**
  ```cmd
  python check_dataset.py
  ```
