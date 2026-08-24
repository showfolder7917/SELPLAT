@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

for %%I in ("%~dp0..") do set "AI_DESKTOP_ROOT=%%~fI"
cd /d "%AI_DESKTOP_ROOT%"

if /i not "%~1"=="developer" (
  echo [ERROR] AI Desktop only supports the developer variant.
  pause
  exit /b 1
)

if not defined SELPLAT_ROOT for %%I in ("%AI_DESKTOP_ROOT%\..\..") do set "SELPLAT_ROOT=%%~fI"
if not exist "%SELPLAT_ROOT%\settings.gradle" (
  echo [ERROR] Invalid SELPLAT root: %SELPLAT_ROOT%
  pause
  exit /b 1
)

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

echo [SETUP] Checking the package-lock-specific dependency cache...
call npm run dependencies:ensure
if errorlevel 1 (
  echo [ERROR] Dependency cache preparation failed.
  pause
  exit /b 1
)

echo [BUILD] Compiling Developer desktop application...
call npm run start:developer
set "APP_EXIT_CODE=%ERRORLEVEL%"

:app_finished
echo.
echo [EXIT] Application stopped with code %APP_EXIT_CODE%.
pause
exit /b %APP_EXIT_CODE%
