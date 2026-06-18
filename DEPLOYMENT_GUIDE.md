# 🚀 Complete Free Deployment Guide
# Ancient Tamil Inscription Translator

**Total cost: $0.00** — both backend and frontend are fully free forever.

---

## ✅ Current Status

| Component | Status | URL |
|-----------|--------|-----|
| Backend (FastAPI + ML Model) | **LIVE** ✅ | https://tamil-script-translator.onrender.com |
| Frontend (React App) | **LIVE** ✅ | https://tamil-script-translator.vercel.app |

---

## How It Works (Overview)

```
User Browser
    │
    ▼
Vercel (Frontend — FREE forever)
    │  sends image via HTTP POST
    ▼
Render.com (Backend — FREE tier)
    │  runs segmentation + EfficientNet model
    ▼
Returns translation JSON
```

---

## Step 1: Push Code to GitHub ✅ (Already Done)

Your code is already on GitHub at:
`https://github.com/Jai-0709/tamil-script-translator`

Any time you make changes locally, run:
```bash
git add .
git commit -m "your message here"
git push
```
Both Render and Vercel will **automatically redeploy** when you push.

---

## Step 2: Backend on Render.com ✅ (Already Live)

Your backend is already deployed and running for free at:
**https://tamil-script-translator.onrender.com**

### ⚠️ Important: Free Tier "Cold Start"
Render's free tier **spins down after 15 minutes of no traffic**. The first request after idle will take **30–60 seconds** to wake up. Subsequent requests are fast. This is normal behaviour on the free tier.

To check if the backend is awake, open this URL in your browser:
```
https://tamil-script-translator.onrender.com/health
```
If it responds `{"status": "ok"}`, it's awake. If it times out, wait 60 seconds and try again.

### If You Ever Need to Redeploy the Backend
1. Go to [render.com](https://render.com) → Dashboard → `tamil-script-translator`
2. Click **Manual Deploy** → **Deploy latest commit**

---

## Step 3: Deploy Frontend on Vercel (FREE — Do This Now)

Vercel is the easiest and most reliable free frontend host. No credit card needed.

### 3.1 — Create a Vercel Account
1. Go to **[vercel.com](https://vercel.com)**
2. Click **Sign Up** → **Continue with GitHub**
3. Authorize Vercel to access your GitHub account

### 3.2 — Import Your Project
1. After logging in, click **Add New → Project**
2. Find `tamil-script-translator` in the list and click **Import**
3. Vercel will detect it as a monorepo (has both `frontend/` and `backend/`)

### 3.3 — Configure the Frontend Build
On the configuration screen:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` ← **Click "Edit" and type this** |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 3.4 — Add Environment Variable
Scroll down to **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `VITE_BACKEND_URL` | `https://tamil-script-translator.onrender.com` |

> ⚠️ No trailing slash at the end of the URL!

### 3.5 — Deploy
Click **Deploy**. Vercel will build and deploy in about 1–2 minutes.

You will get a free URL like:
`https://tamil-script-translator.vercel.app`

**That's your live website!** 🎉

---

## Step 4: Test Your Live Website

1. Open your Vercel URL in the browser
2. Upload a Tamil inscription image
3. Click **Translate**
4. **First request may take 30–60 seconds** (backend waking up from free tier sleep)
5. Subsequent requests will be fast

---

## Step 5: Share Your Project

Share these two links:
- **Live App:** `https://your-project.vercel.app`
- **API Docs:** `https://tamil-script-translator.onrender.com/docs`

The `/docs` URL gives a full interactive Swagger UI for your API — great for showing in demos!

---

## Keeping Everything Free — Summary

| Service | What It Hosts | Free Tier Limits | Cost |
|---------|--------------|-----------------|------|
| **GitHub** | Your source code | Unlimited public repos | **$0** |
| **Render.com** | FastAPI backend + ML model | 750 hrs/month, sleeps after 15 min idle | **$0** |
| **Vercel** | React frontend | 100 GB bandwidth/month, unlimited deploys | **$0** |

### Total: **$0/month** ✅

---

## Making Changes After Deployment

1. Edit your code locally
2. Run and test locally (`uvicorn main:app` + `npm run dev`)
3. Push to GitHub:
   ```bash
   git add .
   git commit -m "describe your change"
   git push
   ```
4. **Render** auto-redeploys the backend (takes 3–5 min)
5. **Vercel** auto-redeploys the frontend (takes 1–2 min)

---

## Troubleshooting

### "Failed to load resource: net::ERR_CONNECTION_REFUSED"
→ The backend has gone to sleep. Wait 60 seconds and try again.

### "No words detected" from the API
→ The segmentation is still being tuned. Try a clearer image.

### Frontend shows old version after push
→ Go to Vercel dashboard → your project → Deployments → check the latest deploy status.

### Backend crashes (Out of Memory)
→ Render's free tier has 512MB RAM. If the model exceeds it, the service will restart.
   The model should load fine on free tier — it was tested successfully.

---

*Guide last updated: June 2026*
