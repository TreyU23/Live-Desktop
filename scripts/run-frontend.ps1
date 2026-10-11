$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repositoryRoot "frontend"
$userProfileRoot = [Environment]::GetFolderPath("UserProfile")
$bundledDependencies = Join-Path $userProfileRoot ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$runtimeNode = Join-Path $bundledDependencies "node\bin"
$runtimePnpm = Join-Path $bundledDependencies "bin\fallback\pnpm.cmd"

if (Test-Path $runtimeNode) {
    $env:Path = "$runtimeNode;$env:Path"
}

if (-not (Test-Path $runtimePnpm)) {
    $pnpmCommand = Get-Command "pnpm" -ErrorAction SilentlyContinue
    if ($null -eq $pnpmCommand) {
        throw "pnpm is required. Install Node.js and pnpm, then run this script again."
    }
    $runtimePnpm = $pnpmCommand.Source
}

Push-Location $frontendRoot
try {
    & $runtimePnpm run dev --host 127.0.0.1 --port 4173 --strictPort
} finally {
    Pop-Location
}
