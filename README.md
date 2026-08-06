# 🏛️ Classical Tamil Epigraphy Suite (v2.0)
> **AI-Powered Computational Epigraphy Engine for Ancient Chola, Pandya, and Pallava Inscription Analysis**

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff.svg)](https://vitejs.dev/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-ee4c2c.svg)](https://pytorch.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini%20AI-2.5%20Flash-4285f4.svg)](https://deepmind.google/technologies/gemini/)

---

## 📌 Executive Overview

The **Classical Tamil Epigraphy Suite v2.0** is a end-to-end computational epigraphy and optical character recognition (OCR) platform tailored for reading, segmenting, classifying, and translating ancient Tamil stone inscriptions (கல்வெட்டுகள்), palm-leaf manuscripts, and temple rubbings into modern Tamil and fluent English.

Combining **YOLO Smart-Tiled Contour Segmentation**, a **ResNet 247-Class Modern Tamil Glyph Classifier**, a **Real-Time Vector Memory Store**, and **Gemini Epigraphic Context Refinement**, the suite provides line-by-line inscriptional translation, grammatical breakdown, and epigraphic gold weight conservation.

---

## ✨ Key Features & Technical Capabilities

### 1. 🔍 Pure YOLO & Contour Line/Character Segmentation
- **Zero Artificial Box Splitting**: Uses authentic contour segmentation to preserve single compound Tamil glyphs (`பொ`, `கொ`, `னெ`).
- **Physical Line Breakdown**: Automatically groups detected bounding boxes by physical stone inscription lines.
- **Interactive 72vh Crop Region Mode**: High-resolution interactive cropping allowing users to draw precise target boxes across any inscription line.

### 2. 🔤 ResNet 247-Class Glyph Classifier & Vector Memory
- Matches extracted ancient character crops against all 247 modern Tamil alphabet classes.
- **Interactive Character Breakdown**: Hover over any detected bounding box for instant 4X lens magnification and spotlighting.
- **Few-Shot Vector Memory Store**: Retains manual character overrides locally (`vector_memory`), propagating learned corrections across sessions.

### 3. 📜 Gemini Epigraphic Analysis Engine (Line-by-Line)
- **Epigraphic Word Spacing**: Inserts clean word spaces between ancient Tamil words (`epigraphic_text`), avoiding concatenated unbroken text.
- **Epigraphic Weight & Measurement Conservation**: Protects ancient gold weight metrics (`கழஞ்சு`, `கழஞ்சரை`, `மஞ்சாடி`) from misinterpretation as regnal year formulas.
- **Structured Per-Line Packages**: Returns line-by-line readings, modern Tamil meanings, English translations, historical context notes, and word breakdowns.
- **Bilingual Tamil + English Mode**: Academic-grade publication format with zero decorative emojis.

### 4. 📊 Dataset & Memory Studio
- **Dataset Studio**: Inspect, search, filter, and delete class folder crops or export labelled training sets (`JSON`).
- **Memory Studio**: Backup vector feature embeddings and saved image layout coordinates.

### 5. 📱 100% Mobile & Tablet Responsive Architecture
- Apple-inspired design system with dark/light themes.
- Animated mobile navigation drawer and responsive 1-column single-page layout for smartphones.

---

## 🏗️ System Architecture

```mermaid
graph TD
    A["Uploaded Stone Inscription Image"] --> B["YOLO Contour Segmentation"]
    B --> C["Physical Line & Bounding Box Extraction"]
    C --> D["ResNet 247-Class Classifier"]
    D --> E["Vector Memory Override Engine"]
    E --> F["Gemini Epigraphic Refinement AI"]
    F --> G["Structured Line-by-Line Inscription Reading"]
    G --> H["Modern Tamil & English Translation + Word Breakdown"]
```

---

## 📁 Repository Directory Structure

```
TAMIL SCRIPT VERSION 2/
├── backend/                  # FastAPI Python Backend
│   ├── main.py               # Main API endpoints (/api/segment, /api/gemini/refine)
│   ├── gemini_engine.py      # Gemini AI Epigraphic Prompt Engine
│   ├── segmentation.py       # YOLO & OpenCV Contour Segmentation Logic
│   ├── classification.py     # ResNet 247-Class Classifier
│   ├── memory_store.py       # Vector Feature & Layout Memory Store
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React + Vite Frontend App
│   ├── src/
│   │   ├── components/       # InscriptionCanvas, OriginalImageViewer, Navbar, SentenceOutput
│   │   ├── pages/            # LandingPage, DatasetStudio, MemoryStudio
│   │   ├── App.jsx           # Main Workspace Controller
│   │   └── index.css         # Apple-inspired Responsive Design System
│   ├── package.json
│   └── vite.config.js
├── models/                   # Model Checkpoints & Metadata
├── scripts/                  # Training & Dataset Preparation Utility Scripts
├── docs/                     # Documentation & Hosting Guides
├── .gitignore                # Clean Git ignore configuration
└── README.md                 # Master Project Documentation
```

---

## ⚡ Local Installation & Quickstart

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: 18.0 or higher
- **Gemini API Key**: Obtain from [Google AI Studio](https://aistudio.google.com/)

### 1. Setup Backend
```bash
# Navigate to project root
cd "TAMIL SCRIPT VERSION 2"

# Create virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Set Gemini API Key
set GEMINI_API_KEY=your_actual_gemini_api_key

# Start FastAPI server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Setup Frontend
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🌐 100% Free Hosting & Deployment Guide

| Component | Free Platform | Recommended Specs |
| :--- | :--- | :--- |
| **Frontend (React)** | **Vercel** / **Render** | 100% Free, Global CDN, Free SSL |
| **Backend (FastAPI)** | **Hugging Face Spaces** | **16 GB RAM + 2 vCPUs FREE** (Handles PyTorch & YOLO models without RAM limits!) |

*For complete step-by-step deployment instructions, refer to [docs/deployment_hosting_guide.md](docs/deployment_hosting_guide.md).*

---

## 📜 License & Acknowledgments

- Developed for Epigraphic Research & Computational Tamil Linguistics.
- **License**: MIT License.
