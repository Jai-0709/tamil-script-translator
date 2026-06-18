@echo off
title Ancient Tamil — Frontend Dev Server
echo ============================================================
echo  Starting React Frontend
echo  URL: http://localhost:5173
echo ============================================================

cd /d "E:\TAMIL SCRIPT VERSION 2\frontend"

if not exist "node_modules" (
    echo [WARN] node_modules not found. Running npm install first...
    npm install
    echo.
)

echo [INFO] Starting Vite dev server...
echo.

npm run dev

pause
