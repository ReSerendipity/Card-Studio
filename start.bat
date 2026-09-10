@echo off
chcp 65001 >nul
cd /d "%~dp0src-web"
echo Starting Card Studio ...
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org/
  pause
  exit /b 1
)
node server.js
pause
