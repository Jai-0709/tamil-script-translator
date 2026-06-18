@echo off
title Ancient Tamil — Backend Server
echo ============================================================
echo  Starting FastAPI Backend
echo  URL: http://localhost:8000
echo  Docs: http://localhost:8000/docs
echo ============================================================

cd /d "E:\TAMIL SCRIPT VERSION 2"

:: Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    echo [INFO] Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo [WARN] No venv found. Using system Python.
    echo        Run setup.bat first to create the virtual environment.
)

echo.
echo [INFO] Starting uvicorn...
echo.

cd /d "E:\TAMIL SCRIPT VERSION 2\backend"
uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
