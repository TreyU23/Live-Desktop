param([switch]$SkipBuild, [switch]$IncludeJavaRuntime)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $SkipBuild) { & "$PSScriptRoot\build-production.ps1" }
$distribution = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $distribution -Force | Out-Null
$stage = Join-Path $distribution ('package-' + [Guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $stage 'Live-Desktop'
$archive = Join-Path $distribution 'Live-Desktop-windows-x64.zip'
try {
    New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
    $files = @('start.cmd', '.env.example', 'README.md', 'backend\README.md', 'frontend\README.md', 'native\README.md', 'scripts\bootstrap-java.ps1')
    foreach ($name in @('live-desktop-launcher.exe', 'live-desktop-host.exe', 'live-desktop-windows-bridge.exe', 'live-desktop-credentials.dll')) {
        $files += "native\build\Release\$name"
    }
    foreach ($relative in $files) {
        $source = Join-Path $projectRoot $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing package artifact: $relative. Build production first." }
        $target = Join-Path $packageRoot $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $target
    }
    foreach ($relative in @('backend\target\runtime', 'frontend\dist\client', 'docs')) {
        $target = Join-Path $packageRoot $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $projectRoot $relative) -Destination $target -Recurse
    }
    if ($IncludeJavaRuntime) {
        $javaSource = Join-Path $projectRoot '.tools\jdk-21'
        if (-not (Test-Path -LiteralPath (Join-Path $javaSource 'bin\java.exe'))) { throw 'Run scripts/bootstrap-java.ps1 before packaging with -IncludeJavaRuntime.' }
        New-Item -ItemType Directory -Path (Join-Path $packageRoot '.tools') -Force | Out-Null
        Copy-Item -LiteralPath $javaSource -Destination (Join-Path $packageRoot '.tools\jdk-21') -Recurse
    }
    @'
# Install Live Desktop

Extract the entire Live-Desktop folder to a writable directory on Windows 10/11 x64.
If .tools/jdk-21 is absent, install Java 21 and set JAVA_HOME, or run scripts/bootstrap-java.ps1.
Run start.cmd. Open http://localhost:4173 after it reports ready.
Node, pnpm, Maven, Visual Studio, and CMake are build tools and are not needed to run this package.
The native binaries include the MSVC runtime statically; no separate VC++ runtime installation is needed.
Use Settings to save profile credentials, or copy .env.example to .env for the default profile.
Keep the directory private to your Windows account. Do not place it in a location others can modify.
Stop with native/build/Release/live-desktop-launcher.exe shutdown before replacing files.
Logs and .startup-metrics.jsonl are written next to start.cmd. See README.md for troubleshooting.
Source rebuild commands in the READMEs require a source checkout; this ZIP contains runtime artifacts.
This package contains no saved user data, .env, logs, node_modules, or build tool caches.
'@ | Set-Content -LiteralPath (Join-Path $packageRoot 'INSTALL.md')
    $manifest = @(Get-ChildItem -LiteralPath $packageRoot -Recurse -File -Force | ForEach-Object {
        [ordered]@{ path = $_.FullName.Substring($packageRoot.Length + 1).Replace('\', '/'); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); bytes = $_.Length }
    })
    [ordered]@{ formatVersion = 1; platform = 'windows-x64'; includesJavaRuntime = [bool]$IncludeJavaRuntime; files = $manifest } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $packageRoot 'manifest.json')
    # ZipFile includes hidden .tools/.env.example files which Compress-Archive can omit.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    [IO.Compression.ZipFile]::CreateFromDirectory($stage, $archive)
    Write-Output "Packaged $archive"
} finally {
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if ($resolvedStage.StartsWith([IO.Path]::GetFullPath($distribution) + '\', [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force -ErrorAction SilentlyContinue
    }
}
