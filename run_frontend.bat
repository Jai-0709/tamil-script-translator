@echo off
title Ancient Tamil — Frontend Dev Server
echo ============================================================
echo  Starting React Frontend
echo  URL: http://localhost:5173
echo ============================================================

cd /d "%~dp0frontend"

echo [INFO] Ensuring port 5173 is free...
powershell -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

if not exist "node_modules" (
    echo [WARN] node_modules not found. Running npm install first...
    npm install
    echo.
)

echo [INFO] Starting Vite dev server...
echo.

npm run dev

pause
