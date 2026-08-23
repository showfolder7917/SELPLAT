@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set "DESKTOP_VARIANT=%~1"
if not defined DESKTOP_VARIANT set "DESKTOP_VARIANT=office"
if /i not "%DESKTOP_VARIANT%"=="office" if /i not "%DESKTOP_VARIANT%"=="developer" (
  echo [ERROR] Unknown desktop variant: %DESKTOP_VARIANT%
  pause
  exit /b 1
)

if not defined SELPLAT_ROOT set "SELPLAT_ROOT=%CD%\..\.."

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

if /i "%DESKTOP_VARIANT%"=="developer" (
  echo [DEV] Starting Developer with renderer hot reload and automatic Electron restart...
  call npm run desktop:dev:developer
  set "APP_EXIT_CODE=%ERRORLEVEL%"
  goto app_finished
)

echo [BUILD] Compiling %DESKTOP_VARIANT% desktop application...
call npm run build:%DESKTOP_VARIANT%
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo [START] %DESKTOP_VARIANT%
set "AI_DESKTOP_VARIANT=%DESKTOP_VARIANT%"
call npm run start:%DESKTOP_VARIANT%
set "APP_EXIT_CODE=%ERRORLEVEL%"

:app_finished
echo.
echo [EXIT] Application stopped with code %APP_EXIT_CODE%.
pause
exit /b %APP_EXIT_CODE%
