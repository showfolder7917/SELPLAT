@echo off
setlocal
chcp 65001 >nul

rem ai-memory is an HTTP client for AI Factory. It never creates an HTTP listener.
for %%I in ("%~dp0..\..") do set "SELPLAT_ROOT=%%~fI"
if not defined SELPLAT_PYTHON set "SELPLAT_PYTHON=python"

"%SELPLAT_PYTHON%" --version >nul 2>nul
if errorlevel 1 (
    echo [ai-memory] Python is unavailable. Set SELPLAT_PYTHON to a verified interpreter. 1>&2
    exit /b 1
)

set "PYTHONPATH=%SELPLAT_ROOT%\apps\ai-memory\src\main\python;%SELPLAT_ROOT%\apps\rule-engine\backend\src\main\python;%PYTHONPATH%"
set "PYTHONPYCACHEPREFIX=%SELPLAT_ROOT%\cache\python-pycache"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
cd /d "%SELPLAT_ROOT%"

if "%~1"=="" (
    "%SELPLAT_PYTHON%" "%SELPLAT_ROOT%\apps\ai-memory\src\main\python\ai_memory_entry.py" daemon
) else (
    "%SELPLAT_PYTHON%" "%SELPLAT_ROOT%\apps\ai-memory\src\main\python\ai_memory_entry.py" %*
)
exit /b %errorlevel%
