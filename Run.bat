@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo Checking Node.js installation...
where node >nul 2>nul
if !errorlevel! neq 0 (
    echo Node.js is not installed or not in PATH.
    echo Please install Node.js from: https://nodejs.org/en/
    echo After installing, you may need to close and reopen this window.
    pause
    exit /b 1
)

echo Checking npm installation...
where npm >nul 2>nul
if !errorlevel! neq 0 (
    echo npm is not available. Please ensure Node.js installation includes npm.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo Failed to install dependencies. Please check the errors above.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully.
)

echo Starting the development server...
call npm run dev
if !errorlevel! neq 0 (
    echo Failed to start the development server.
    pause
    exit /b 1
)