@echo off
chcp 65001 >nul
cd /d "%~dp0src-web"
echo 正在启动 Card Studio ...
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js：https://nodejs.org/
  pause
  exit /b 1
)
node server.js
pause
