# Deployment Guide for Ancient Tamil Inscription Translator

Welcome! Deploying a machine learning model might sound intimidating, but because you have a modern stack (FastAPI + React), we can deploy this easily using free or low-cost services.

The best platform for beginners is **Render.com**. We will deploy the **Backend** as a Docker Web Service, and the **Frontend** as a Static Site. 

I have already updated your codebase to support deployment (updated CORS and API URLs). Follow these step-by-step instructions.

---

## Step 1: Upload your code to GitHub
To deploy easily, your code needs to be on GitHub.
1. Create an account on [GitHub.com](https://github.com/).
2. Create a new repository (name it something like `tamil-translator`).
3. Open your terminal in VS Code, and run these commands to push your project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/tamil-translator.git
   git push -u origin main
   ```

---

## Step 2: Deploy the Backend on Render
The backend needs Python, OpenCV, and PyTorch, which is why we created a `Dockerfile`.

1. Go to [Render.com](https://render.com/) and create an account using your GitHub.
2. Click **New** -> **Web Service**.
3. Select **"Build and deploy from a Git repository"** and click **Next**.
4. Connect your GitHub account and select your `tamil-translator` repository.
5. Fill in the details:
   - **Name:** `tamil-translator-backend`
   - **Region:** Choose whatever is closest to you (e.g., Singapore, Frankfurt).
   - **Branch:** `main`
   - **Root Directory:** *(leave this completely blank)*
   - **Runtime:** `Docker` *(Render will automatically detect the Dockerfile we created).*
6. **Instance Type:** Since PyTorch is heavy, the Free tier (512MB RAM) *might* run out of memory. Try the **Free** tier first. If it crashes during deployment with an "Out of Memory" error, you will need to upgrade to the **Starter** tier ($7/month, 512MB) or the **Standard** tier ($25/month, 2GB RAM).
7. Click **Create Web Service**.
8. Wait for it to build (this can take 5-10 minutes). Once it's live, you will get a URL like: `https://tamil-translator-backend.onrender.com`. 
   *(Copy this URL, you need it for the next step!)*

---

## Step 3: Deploy the Frontend on Render (or Vercel)
The frontend is a React (Vite) app, which is completely free to host. We'll use Render to keep it in the same place.

1. Go to your Render Dashboard, click **New** -> **Static Site**.
2. Connect the same `tamil-translator` repository.
3. Fill in the details:
   - **Name:** `tamil-translator-frontend`
   - **Branch:** `main`
   - **Root Directory:** `frontend` *(<- Important!)*
   - **Build Command:** `npm install && npm run build`
   - **Publish directory:** `dist`
4. **Environment Variables:**
   Scroll down and click "Add Environment Variable".
   - **Key:** `VITE_BACKEND_URL`
   - **Value:** Paste the URL from Step 2 (e.g., `https://tamil-translator-backend.onrender.com`). *(Do not put a trailing slash `/` at the end).*
5. Click **Create Static Site**.
6. Wait for the build to finish. Once it's done, Render will give you a live link to your website.

🎉 **Congratulations! Your AI model is now live on the internet!**
