@echo off
title Mission Control
echo.
echo  ========================================
echo   Mission Control - Starting up...
echo  ========================================
echo.

:: Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed or not in PATH.
    echo  Download it from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Pull latest code
echo  Pulling latest code...
git pull
echo.

:: Install all dependencies
echo  Installing dependencies...
call npm run install:all
echo.

:: Build frontend
echo  Building frontend...
call npm run build
echo.

echo  Starting server on http://localhost:4201
echo  Opening browser in 3 seconds...
echo.
echo  (Press Ctrl+C to stop)
echo.

:: Open browser after short delay
start "" cmd /c "timeout /t 3 /noq >nul && start http://localhost:4201"

:: Start the server in production mode
set NODE_ENV=production
npm start
