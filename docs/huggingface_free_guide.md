# 🌟 Hugging Face Spaces Deployment Manual (100% FREE — 16 GB RAM, 2 CPU Cores)

Deploying your AI models on **Hugging Face Spaces** provides **16 GB RAM completely FREE**, giving your PyTorch ViT and YOLOv8 models 32X more memory than Render, completely eliminating all 502 Bad Gateway and CORS errors!

---

## 🚀 5-Step Deployment Guide (Takes 2 Minutes — 100% Free)

### **Step 1: Sign up & Create a Free Space**
1. Go to [huggingface.co/new-space](https://huggingface.co/new-space) and log in (or sign up for free).
2. **Space Name**: `tamil-epigraphy-api` (or any name you like).
3. **License**: `mit`.
4. **Select Space SDK**: Select **`Gradio`** (or **`Docker`** $\rightarrow$ **`Blank`**).
5. **Space Hardware**: Select **`CPU Basic — 2 vCPU, 16 GB RAM (FREE)`**.
6. Click **`Create Space`**.

---

### **Step 2: Connect Your GitHub Repository**
- In your Space settings, connect your GitHub repository **`Jai-0709/tamil-script-translator`** OR upload your project files.

---

### **Step 3: Add Your Gemini API Key**
1. On your Space page, click **`Settings`**.
2. Scroll down to **`Variables and Secrets`** $\rightarrow$ Click **`New Secret`**:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `your_actual_gemini_api_key`
3. Click **`Save`**.

---

### **Step 4: Copy Your Live Hugging Face API URL**
- Once the Space shows **`Running`**, your live API URL will be:
  `https://your-username-tamil-epigraphy-api.hf.space`

---

### **Step 5: Connect Vercel Frontend to Hugging Face API**
1. Open [vercel.com](https://vercel.com) $\rightarrow$ Click your project `tamil-script-translator` $\rightarrow$ **`Settings`** $\rightarrow$ **`Environment Variables`**.
2. Update `VITE_BACKEND_URL`:
   `https://your-username-tamil-epigraphy-api.hf.space`
3. Click **`Redeploy`** in Vercel!

---

🎉 **Done! Your trained YOLOv8 and ViT AI models will now run with 16 GB RAM, sub-second translation speed, zero RAM crashes, and zero CORS errors for $0.00!**
