# 📜 100% FREE Deployment Manual — Step-by-Step (From Start to Finish)

This guide will walk you through deploying your **Classical Tamil Epigraphy Suite** online for **$0.00 / 100% FREE** with **ZERO credit card required**.

---

## 📋 Prerequisites Needed Before Starting (All Free)

1. **GitHub Account**: Your code is already pushed to `https://github.com/Jai-0709/tamil-script-translator`.
2. **Google Gemini API Key**: Free key from [aistudio.google.com](https://aistudio.google.com/).
3. **Render Account**: Free account at [render.com](https://render.com).
4. **Vercel Account**: Free account at [vercel.com](https://vercel.com).

---

## ⚙️ PHASE 1: Deploy the Python Backend API for FREE (Render.com)

We will host the Python FastAPI backend with your trained models on **Render Free Web Service**.

### **Step 1: Sign in to Render**
- Open [render.com](https://render.com) in your browser and log in with your **GitHub account**.

### **Step 2: Create a New Web Service**
- On your Render Dashboard, click the blue **`New +`** button at the top right.
- Select **`Web Service`**.

### **Step 3: Connect Your GitHub Repository**
- Choose **`Build and deploy from a Git repository`** $\rightarrow$ Click **Next**.
- Search for your repository **`Jai-0709/tamil-script-translator`** $\rightarrow$ Click **`Connect`**.

### **Step 4: Fill in Render Backend Settings**
Fill in the deployment form with the following exact values:

| Field | Value to Enter |
| :--- | :--- |
| **Name** | `tamil-epigraphy-backend` |
| **Region** | Select closest region (e.g. `Singapore` or `Oregon`) |
| **Branch** | `main` |
| **Root Directory** | *(Leave blank)* |
| **Runtime** | **`Python 3`** *(Native Python — 100% Free!)* |
| **Build Command** | `pip install -r backend/requirements.txt` |
| **Start Command** | `python app.py` |
| **Instance Type** | Select **`Free`** **($0 / month)** |

### **Step 5: Add Your Gemini API Key**
- Scroll down to the **Environment Variables** section.
- Click **`Add Environment Variable`**:
  - **Key**: `GEMINI_API_KEY`
  - **Value**: `paste_your_gemini_api_key_here`

### **Step 6: Deploy Backend**
- Scroll to the bottom and click **`Create Web Service`**.
- Render will start installing dependencies and starting the server. This takes **2-3 minutes**.

### **Step 7: Copy Your Live Backend URL**
- Once deployment finishes and shows **`Live`**, look at the top left under the project name.
- Copy your live backend URL (it will look like: `https://tamil-epigraphy-backend.onrender.com`).

---

## 🎨 PHASE 2: Deploy the React Frontend UI for FREE (Vercel)

Now we will host the React frontend on **Vercel** and connect it to your live Render backend.

### **Step 1: Sign in to Vercel**
- Open [vercel.com](https://vercel.com) in your browser and log in with your **GitHub account**.

### **Step 2: Import Your GitHub Repository**
- On your Vercel Dashboard, click **`Add New...`** $\rightarrow$ **`Project`**.
- Find your repository **`Jai-0709/tamil-script-translator`** $\rightarrow$ Click **`Import`**.

### **Step 3: Configure Vercel Project Settings**
- **Project Name**: `tamil-script-translator` *(or any name you like)*.
- **Framework Preset**: Select **`Vite`** *(should be automatically selected)*.
- **Root Directory**: Click **Edit** $\rightarrow$ Select the **`frontend`** folder $\rightarrow$ Click **Save**.

### **Step 4: Add Environment Variable to Connect to Backend**
- Expand the **`Environment Variables`** section.
- Add the following variable:
  - **Name**: `VITE_BACKEND_URL`
  - **Value**: `https://tamil-epigraphy-backend.onrender.com` *(Paste the exact URL you copied from Render in Phase 1)*

### **Step 5: Deploy Frontend**
- Click the blue **`Deploy`** button.
- Vercel will build your website in **~45 seconds**.

### **Step 6: Open Your Live Web Application!**
- Click **`Continue to Dashboard`** or click the **`Visit`** button.
- Your website is now **100% LIVE ON THE INTERNET FOR $0.00!** (e.g. `https://tamil-script-translator.vercel.app`).

---

## 🧪 PHASE 3: Final Verification & Testing

1. Open your live Vercel URL on your phone or computer.
2. Click **`Open Workspace`**.
3. Upload any stone inscription image (or choose a sample photo).
4. Click **`Analyse`** $\rightarrow$ Verify that bounding box segmentation, character classification, and Gemini AI line-by-line bilingual Tamil & English translation load smoothly!

---

## 🎯 Summary of Your Live URLs

- 🟢 **Frontend Web Application (Vercel)**: `https://tamil-script-translator.vercel.app`
- 🟢 **Backend API Server (Render)**: `https://tamil-epigraphy-backend.onrender.com`
- 💰 **Total Monthly Cost**: **$0.00 / FREE FOREVER**
