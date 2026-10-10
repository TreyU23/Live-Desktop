$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$cmakeCommand = Get-Command cmake -ErrorAction SilentlyContinue
$cmakePath = if ($cmakeCommand) { $cmakeCommand.Source } else { $null }
if (-not $cmakePath) {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path -LiteralPath $vswhere) {
        $installation = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($installation) {
            $candidate = Join-Path $installation "Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
            if (Test-Path -LiteralPath $candidate) { $cmakePath = $candidate }
        }
    }
}
if (-not $cmakePath) { throw "Install Visual Studio Build Tools with Desktop development with C++, the Windows SDK, and CMake tools." }
$ctestPath = Join-Path (Split-Path -Parent $cmakePath) "ctest.exe"
if (-not (Test-Path -LiteralPath $ctestPath)) { throw "CTest is missing from the CMake installation." }
& $cmakePath -S (Join-Path $projectRoot "native") -B (Join-Path $projectRoot "native\build") -G "Visual Studio 17 2022" -A x64
if ($LASTEXITCODE -ne 0) { throw "Native bridge configuration failed." }
& $cmakePath --build (Join-Path $projectRoot "native\build") --config Release
if ($LASTEXITCODE -ne 0) { throw "Native bridge build failed." }
& $ctestPath --test-dir (Join-Path $projectRoot "native\build") -C Release --output-on-failure
if ($LASTEXITCODE -ne 0) { throw "Native bridge protocol tests failed." }
Write-Output "Built native/build/Release/live-desktop-launcher.exe, live-desktop-host.exe, live-desktop-windows-bridge.exe and live-desktop-credentials.dll"
