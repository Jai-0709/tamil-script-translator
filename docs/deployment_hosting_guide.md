# 100% FREE Deployment Guide (Zero Cost, No Credit Card, No Docker Required)

---

## 🏗️ 100% Free Hosting Stack Architecture

| Component | 100% Free Platform | Specs & Benefits | Cost |
| :--- | :--- | :--- | :--- |
| **Frontend (React UI)** | **Vercel** / **Netlify** | • Global High-Speed CDN<br>• Automated GitHub Builds<br>• Free SSL HTTPS | **$0.00 / FREE** |
| **Backend (FastAPI + AI Models)** | **Render.com** or **Hugging Face Spaces (Gradio SDK)** | • **Render**: Free Native Python Web Service<br>• **Hugging Face**: Free CPU Basic (16GB RAM) | **$0.00 / FREE** |

---

## 🚀 Option 1: Render.com (100% FREE Native Python Service — RECOMMENDED)

Render allows hosting Python FastAPI web services for **$0 / FREE** without needing Docker or credit card details.

### Step 1: Deploy Backend to Render (Free Web Service)

1. Sign up for free at [render.com](https://render.com).
2. Click **New +** $\rightarrow$ Select **Web Service**.
3. Connect your GitHub repository `Jai-0709/tamil-script-translator`.
4. Configure these settings:
   - **Name**: `tamil-epigraphy-backend`
   - **Environment**: `Python 3` *(Native Python — 100% Free!)*
   - **Region**: Select closest region (e.g. Singapore / Oregon).
   - **Branch**: `main`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python app.py`
   - **Instance Type**: **Free ($0/month)**
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: `your_actual_gemini_api_key`
6. Click **Create Web Service**. Your live backend URL will be:
   `https://tamil-epigraphy-backend.onrender.com`

---

## 🚀 Option 2: Hugging Face Spaces (100% FREE Gradio / Python SDK)

*Note: Use the **Gradio / Python SDK** (NOT Docker) to get 100% Free CPU Basic hosting.*

### Step 1: Deploy Backend to Hugging Face (Free Python Space)

1. Sign up for free at [huggingface.co](https://huggingface.co).
2. Click **New Space** $\rightarrow$ Select Space Name (e.g. `tamil-epigraphy-api`).
3. Select SDK: **Gradio** (Select **CPU Basic — Free**).
4. Upload your project code (`app.py`, `backend/`, `models/`).
5. Update `requirements.txt` in Space root:
```
fastapi
uvicorn
torch
torchvision
ultralytics
opencv-python-headless
google-generativeai
python-multipart
```
6. Add `GEMINI_API_KEY` under Space **Settings** $\rightarrow$ **Variables and Secrets**.
7. Done! Your live API URL will be:
   `https://your-username-tamil-epigraphy-api.hf.space`

---

## 🌐 Step 2: Deploy Frontend to Vercel (100% FREE)

1. Sign up for free at [vercel.com](https://vercel.com).
2. Click **Add New** $\rightarrow$ **Project** $\rightarrow$ Select `Jai-0709/tamil-script-translator`.
3. Set **Root Directory**: `frontend`
4. Under **Environment Variables**, add:
   - `VITE_BACKEND_URL`: `https://tamil-epigraphy-backend.onrender.com`
5. Click **Deploy**. Vercel will give you a live production website:
   `https://tamil-script-translator.vercel.app`
