@echo off
setlocal

for %%I in ("%~dp0.") do set "LIVE_DESKTOP_ROOT=%%~fI"
if not exist "%LIVE_DESKTOP_ROOT%\native\build\Release\live-desktop-launcher.exe" (
    echo Build production artifacts first with scripts\build-production.ps1.
    exit /b 1
)
"%LIVE_DESKTOP_ROOT%\native\build\Release\live-desktop-launcher.exe" start --root "%LIVE_DESKTOP_ROOT%"

if errorlevel 1 (
    echo Live Desktop could not start. Check the error above and the project log files.
    exit /b 1
)

echo Live Desktop is running in the background.
echo Dashboard: http://localhost:4173
exit /b 0
