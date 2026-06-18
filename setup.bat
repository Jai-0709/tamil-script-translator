@echo off
title Ancient Tamil — One-Time Setup
echo ============================================================
echo  Ancient Tamil Inscription Translator — Setup
echo ============================================================
echo.

cd /d "E:\TAMIL SCRIPT VERSION 2"

:: ── Step 1: Python virtual environment ──────────────────────────────────
echo [1/4] Creating Python virtual environment...
if exist "venv" (
    echo       venv already exists. Skipping creation.
) else (
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv. Is Python installed and on PATH?
        pause
        exit /b 1
    )
    echo       Done.
)
echo.

:: ── Step 2: Activate venv ───────────────────────────────────────────────
echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate venv.
    pause
    exit /b 1
)
echo       Done.
echo.

:: ── Step 3: Install Python requirements ─────────────────────────────────
echo [3/4] Installing Python dependencies...
pip install --upgrade pip
pip install -r "E:\TAMIL SCRIPT VERSION 2\backend\requirements.txt"
if errorlevel 1 (
    echo [ERROR] pip install failed. Check backend\requirements.txt.
    pause
    exit /b 1
)
echo       Done.
echo.

:: ── Step 4: Install Node / npm dependencies ──────────────────────────────
echo [4/4] Installing frontend Node dependencies...
cd /d "E:\TAMIL SCRIPT VERSION 2\frontend"
where npm >nul 2>&1
if errorlevel 1 (
    echo [WARN] npm not found. Please install Node.js from https://nodejs.org/
    echo        Then re-run this setup script.
) else (
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo       Done.
)
echo.

:: ── Done ────────────────────────────────────────────────────────────────
echo ============================================================
echo  Setup complete!
echo.
echo  To start the project:
echo    1. Double-click  run_backend.bat   (starts API on :8000)
echo    2. Double-click  run_frontend.bat  (starts UI  on :5173)
echo.
echo  To train the model:
echo    python "E:\TAMIL SCRIPT VERSION 2\backend\train.py"
echo.
echo  To test the pipeline:
echo    python test_pipeline.py --image "path\to\inscription.jpg"
echo.
echo  To check the dataset:
echo    python check_dataset.py
echo ============================================================
echo.
pause
