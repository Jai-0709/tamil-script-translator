@echo off
title Ancient Tamil — Backend Server
echo ============================================================
echo  Starting FastAPI Backend
echo  URL: http://localhost:8000
echo  Docs: http://localhost:8000/docs
echo ============================================================

cd /d "%~dp0"

echo [INFO] Ensuring port 8000 is free...
powershell -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

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

cd /d "%~dp0backend"
uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
