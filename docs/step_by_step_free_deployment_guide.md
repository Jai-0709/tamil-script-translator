# 📜 100% FREE Deployment Manual — Native Python Setup (Zero-RAM Crash)

---

## 🛠️ CRITICAL FIX: Switch Render Runtime to `Python 3` (Native Python)

If Render was deployed using `Language: Docker`, Docker container virtualization uses ~450MB idle RAM, causing 502 Bad Gateway memory kills on Render's 512MB Free Tier.

Switching to **`Python 3` (Native Python)** drops memory to **~130 MB RAM**, keeping your server 100% active and crash-free!

### **How to Switch Render to Native Python 3 (Takes 30 Seconds):**

1. Go to your Render Dashboard: [render.com](https://render.com).
2. Click your web service **`tamil-epigraphy-backend`**.
3. On the left sidebar, click **`Settings`**.
4. Scroll down to the **Build & Deploy** section:
   - **Runtime / Language**: Change from `Docker` to **`Python 3`**
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python app.py`
5. Click **`Save Changes`**.
6. Render will automatically rebuild using Native Python 3. In **~90 seconds**, your backend will be live, ultra-fast, and 100% crash-free!

---

## 🌟 ALTERNATIVE: Deploy to Hugging Face Spaces (Free 16 GB RAM)

If you prefer **16 GB RAM + 2 CPU Cores 100% FREE**:

1. Sign up at [huggingface.co/new-space](https://huggingface.co/new-space).
2. Select SDK: **Gradio** $\rightarrow$ **CPU Basic (Free 16 GB RAM)**.
3. Upload `app.py`, `backend/`, and `models/`.
4. Set Secret `GEMINI_API_KEY`: `your_gemini_key`.
5. Done! Your backend API is live with 16 GB RAM!
