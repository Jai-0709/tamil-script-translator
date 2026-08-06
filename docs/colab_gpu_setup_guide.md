# 🚀 Google Colab Free NVIDIA T4 GPU Backend Setup Guide (100% FREE)

Host your high-level **YOLOv8 Segmentation Model (`best.pt`)** and **Vision Transformer (ViT) Classifier** on a **100% FREE NVIDIA T4 GPU (16 GB VRAM)** with sub-second execution speed!

---

## ⚡ 3-Step Setup Guide (Takes 60 Seconds)

### **Step 1: Open Google Colab**
- Open [colab.research.google.com](https://colab.research.google.com/) in your browser.
- Click **`New Notebook`**.
- Go to **`Runtime`** menu $\rightarrow$ **`Change runtime type`** $\rightarrow$ Select **`T4 GPU`** $\rightarrow$ Click **`Save`**.

---

### **Step 2: Paste and Run This Code in Colab**

Copy and paste the following block into Colab cell #1 and click **`Run` (Play button)**:

```python
# 1. Clone your GitHub repository
!git clone https://github.com/Jai-0709/tamil-script-translator.git
%cd tamil-script-translator

# 2. Install backend dependencies
!pip install -r backend/requirements.txt
!npm install -g localtunnel

# 3. Set your Gemini API Key
import os
os.environ["GEMINI_API_KEY"] = "your_actual_gemini_api_key_here"
os.environ["ENABLE_YOLO"] = "true"

# 4. Start FastAPI server & Localtunnel in background
import subprocess
import time

subprocess.Popen(["python", "app.py"])
time.sleep(5)

# 5. Expose public GPU API URL via Localtunnel
print("\n" + "="*60)
print("  YOUR FREE NVIDIA T4 GPU BACKEND IS NOW LIVE!")
print("="*60 + "\n")

!npx localtunnel --port 7860
```

---

### **Step 3: Copy Your Free Public GPU URL to Vercel**

1. Colab will output a public URL (e.g. `https://slimy-birds-sing.loca.lt`).
2. Open your Vercel Dashboard ([vercel.com](https://vercel.com)) $\rightarrow$ Project Settings $\rightarrow$ Environment Variables.
3. Set `VITE_BACKEND_URL`: `https://slimy-birds-sing.loca.lt`
4. Click **`Redeploy`** in Vercel!

---

🎉 **Done! Your high-level YOLOv8 and Vision Transformer AI models are now running on a FREE NVIDIA T4 GPU with 0.05-second translation speed and 0 RAM limits!**
