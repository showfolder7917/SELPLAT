@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0start-host.ps1"
exit /b %errorlevel%
