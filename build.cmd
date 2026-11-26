@echo off
setlocal

rem Live Desktop one-shot build: Java runtime, frontend deps, native bridge,
rem backend, CDS archive, frontend tests and bundle.
rem   build.cmd        build everything
rem   build.cmd run    stop a running instance, build, then start.cmd

for %%I in ("%~dp0.") do set "LIVE_DESKTOP_ROOT=%%~fI"
set "LAUNCHER=%LIVE_DESKTOP_ROOT%\native\build\Release\live-desktop-launcher.exe"
pushd "%LIVE_DESKTOP_ROOT%" || exit /b 1

if /i "%~1"=="run" if exist "%LAUNCHER%" (
    echo Stopping any running Live Desktop instance...
    "%LAUNCHER%" shutdown --root "%LIVE_DESKTOP_ROOT%" >nul 2>&1
)

if not exist ".tools\jdk-21\bin\java.exe" (
    echo [1/3] Installing project-local Java 21...
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\bootstrap-java.ps1"
    if errorlevel 1 goto :fail
) else (
    echo [1/3] Java 21 already installed.
)

if not exist "frontend\node_modules" (
    echo [2/3] Installing frontend dependencies...
    call pnpm --dir frontend install --frozen-lockfile
    if errorlevel 1 goto :fail
) else (
    echo [2/3] Frontend dependencies already installed.
)

echo [3/3] Building native bridge, backend, and frontend...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\build-production.ps1"
if errorlevel 1 goto :fail

echo.
echo Build complete.
popd
if /i "%~1"=="run" call "%LIVE_DESKTOP_ROOT%\start.cmd"
exit /b %errorlevel%

:fail
echo.
echo Build failed. See the error above.
popd
exit /b 1
