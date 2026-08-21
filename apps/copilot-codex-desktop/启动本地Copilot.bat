@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not defined SELPLAT_ROOT set "SELPLAT_ROOT=%~dp0..\.."

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 20 or newer.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\electron" (
  echo [SETUP] Installing desktop dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [BUILD] Compiling the desktop application...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo [START] Copilot
call "%~dp0node_modules\.bin\electron.cmd" .
set "APP_EXIT_CODE=%ERRORLEVEL%"
echo.
echo [EXIT] Application stopped with code %APP_EXIT_CODE%.
pause
exit /b %APP_EXIT_CODE%
