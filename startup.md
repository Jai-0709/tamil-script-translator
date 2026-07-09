# 🚀 Ancient Tamil Inscription Translator — Startup Guide

This guide explains how to install dependencies and start both the **FastAPI Backend** and the **Vite + React Frontend** step-by-step from your terminal.

---

## 🛠️ Step 1: One-Time Project Setup

Before running the application for the first time, you must install the dependencies for both python (backend) and Node.js (frontend).

### Option A: The Automatic Way (Recommended)
Simply open your project folder and double-click the setup file:
* 📂 Double-click **`setup.bat`**

This will automatically create a virtual environment, install python libraries, and run `npm install` for the frontend.

---

### Option B: The Manual Way (Using the Terminal)

If you prefer to run the setup manually in your terminal, open PowerShell or Command Prompt in the project root directory and run:

1. **Create and activate a Python virtual environment:**
   * **If using PowerShell (default in VS Code terminal):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   * **If using Command Prompt (cmd):**
     ```cmd
     python -m venv venv
     venv\Scripts\activate.bat
     ```

2. **Install Backend Dependencies:**
   ```powershell
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```

3. **Install Frontend Dependencies:**
   ```powershell
   cd frontend
   npm install
   cd ..
   ```

---

## 💻 Step 2: Starting the Servers

To run the application, you need to start **both** the Backend and Frontend servers. Keep both terminal windows open.

### 1. Start the Backend (FastAPI Server)
You can start the backend by either double-clicking **`run_backend.bat`** or running manual commands depending on your terminal's current directory:

#### Option A: If your terminal is in the Project Root Directory
```powershell
# 1. Activate the virtual environment
.\venv\Scripts\Activate.ps1   # (For Command Prompt, run: venv\Scripts\activate.bat)

# 2. Go to the backend directory and start the server
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Option B: If your terminal is already inside the `backend` Directory
```powershell
# 1. Activate the environment from the parent directory
..\venv\Scripts\Activate.ps1  # (For Command Prompt, run: ..\venv\Scripts\activate.bat)

# 2. Start the server (no cd command needed)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
* **API URL**: `http://localhost:8000`
* **Swagger API Documentation**: `http://localhost:8000/docs`

---

### 2. Start the Frontend (React Dev Server)
You can start the frontend by either double-clicking **`run_frontend.bat`** or running these commands:

#### Option A: If your terminal is in the Project Root Directory
```powershell
# Go to frontend folder and run dev server
cd frontend
npm run dev
```

#### Option B: If your terminal is already inside the `frontend` Directory
```powershell
# Run dev server directly (no cd command needed)
npm run dev
```
* **Frontend Web App URL**: `http://localhost:5173`

---

## 🎯 Verification and Diagnostics

### 1. Check Dataset Status
To scan your dataset folders, check class health, and inspect image counts:
```powershell
venv\Scripts\python.exe check_dataset.py
```

### 2. Test the Translation Pipeline via Terminal
To test character segmentation and model classification on a specific image directly from the command line:
```powershell
$env:PYTHONIOENCODING="utf-8"
venv\Scripts\python.exe test_pipeline.py --image "testing 2.jpg"
```
*(The annotated image will be saved as `test_output.jpg`).*

---

## 🧠 Model Training

Once you have trained the model on Kaggle using the steps in **`kaggle_train.py`** and downloaded your model files:
1. Place **`ancient_tamil_classifier.pth`** and **`class_to_idx.json`** into the local folder:
   👉 `models/`
2. Restart the backend server, and it will load the new high-accuracy classifier automatically!
