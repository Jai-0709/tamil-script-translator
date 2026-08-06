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
Render automatically detects the repository configuration:

| Field | Value to Enter / Select |
| :--- | :--- |
| **Name** | `tamil-epigraphy-backend` (or `tamil-script-translator`) |
| **Language** | **`Docker`** *(Autofilled by Render — 100% Free!)* or **`Python 3`** |
| **Branch** | `main` |
| **Region** | Select closest region (e.g. `Singapore`) |
| **Instance Type** | Select **`Free`** **($0 / month)** *(512 MB RAM, 0.1 CPU)* |

### **Step 5: Add Your Gemini API Key**
- Scroll down to the **Environment Variables** section.
- Click **`Add Environment Variable`**:
  - **Key**: `GEMINI_API_KEY`
  - **Value**: `paste_your_gemini_api_key_here`

### **Step 6: Deploy Backend**
- Scroll to the bottom and click **`Create Web Service`**.
- Render will start building the server for **$0 / Free**. This takes **2-3 minutes**.

### **Step 7: Copy Your Live Backend URL**
- Once deployment finishes and shows **`Live`**, look at the top left under the project name.
- Copy your live backend URL (e.g. `https://tamil-script-translator.onrender.com`).

---

## 🎨 PHASE 2: Deploy the React Frontend UI for FREE (Vercel)

Now we will host the React frontend on **Vercel** and connect it to your live Render backend.

### **Step 1: Sign in to Vercel**
- Open [vercel.com](https://vercel.com) in your browser and log in with your **GitHub account**.

### **Step 2: Import Your GitHub Repository**
- On your Vercel Dashboard, click **`Add New...`** $\rightarrow$ **`Project`**.
- Find your repository **`Jai-0709/tamil-script-translator`** $\rightarrow$ Click **`Import`**.

### **Step 3: Configure Vercel Project Settings**
- **Project Name**: `tamil-script-translator`
- **Framework Preset**: Select **`Vite`**
- **Root Directory**: Click **Edit** $\rightarrow$ Select the **`frontend`** folder $\rightarrow$ Click **Save**.

### **Step 4: Add Environment Variable to Connect to Backend**
- Expand the **`Environment Variables`** section.
- Add the following variable:
  - **Name**: `VITE_BACKEND_URL`
  - **Value**: `https://tamil-script-translator.onrender.com` *(Paste your Render URL from Phase 1)*

### **Step 5: Deploy Frontend**
- Click the blue **`Deploy`** button.
- Vercel will build your website in **~45 seconds**.

---

## 🎯 Summary of Your Live URLs

- 🟢 **Frontend Web Application (Vercel)**: `https://tamil-script-translator.vercel.app`
- 🟢 **Backend API Server (Render)**: `https://tamil-script-translator.onrender.com`
- 💰 **Total Monthly Cost**: **$0.00 / FREE FOREVER**
