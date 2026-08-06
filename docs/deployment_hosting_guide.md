# Complete Free Hosting Blueprint — Tamil Script Version 2

---

## 🏗️ Recommended Free Hosting Architecture

| Component | Free Platform | Free Specs & Advantages |
| :--- | :--- | :--- |
| **Frontend (React)** | **Vercel** or **Render** | • 100% Free forever<br>• Global CDN & Free SSL HTTPS<br>• Instant deployment from GitHub |
| **Backend (FastAPI + PyTorch)** | **Hugging Face Spaces** *(Recommended)* or **Render.com** | • **Hugging Face**: **16 GB RAM + 2 vCPUs FREE** (Handles heavy PyTorch models easily!)<br>• **Render**: Free 512MB Python Web Service |

---

## 🚀 Option A: Hugging Face Spaces + Vercel (RECOMMENDED — BEST FOR AI MODELS)

Because PyTorch and YOLO models require RAM and storage, **Hugging Face Spaces** provides **16 GB RAM completely free**, avoiding memory crashes.

### Step 1: Deploy Backend to Hugging Face Spaces (Free)

1. Create a free account at [huggingface.co](https://huggingface.co).
2. Click **New Space** $\rightarrow$ Select Space Name (e.g., `tamil-inscription-api`).
3. Select SDK: **Docker** $\rightarrow$ Blank Space.
4. Upload your project `backend/` folder and `models/` weight files (`resnet_tamil.pth`, `yolov8_tamil.pt`).
5. Create a `Dockerfile` in your Space root:

```dockerfile
FROM python:3.10-slim

# Install system libraries for OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code and models
COPY backend/ ./backend/
COPY models/ ./models/

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Run FastAPI server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
```

6. Add your Environment Variable under Space Settings:
   - `GEMINI_API_KEY`: `your_actual_gemini_api_key`
7. Click **Deploy**. Your live API endpoint will be:
   `https://your-username-tamil-inscription-api.hf.space`

---

### Step 2: Deploy Frontend to Vercel (Free)

1. Create a free account at [vercel.com](https://vercel.com).
2. Click **Add New Project** $\rightarrow$ Import your GitHub repository.
3. Set **Root Directory**: `frontend`
4. Under **Environment Variables**, add:
   - `VITE_BACKEND_URL`: `https://your-username-tamil-inscription-api.hf.space`
5. Click **Deploy**. Vercel will give you a live production link:
   `https://tamil-script-version-2.vercel.app`
