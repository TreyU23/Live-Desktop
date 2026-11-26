$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $projectRoot ".tools"
$jdkTarget = Join-Path $toolRoot "jdk-21"
$downloadRoot = Join-Path $toolRoot "downloads"
$archive = Join-Path $downloadRoot "temurin-jdk21.zip"
$extractRoot = Join-Path $toolRoot "jdk-extract"

if (Test-Path (Join-Path $jdkTarget "bin\java.exe")) {
    Write-Host "Project-local Java is already installed at $jdkTarget"
    exit 0
}

New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null

$assetsUrl = "https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os=windows&vendor=eclipse"
$asset = (Invoke-RestMethod $assetsUrl)[0]
$downloadUrl = $asset.binary.package.link
$expectedHash = $asset.binary.package.checksum.ToLowerInvariant()

Write-Host "Downloading $($asset.release_name)..."
curl.exe -L --fail --output $archive $downloadUrl
if ($LASTEXITCODE -ne 0) {
    throw "The Java download failed."
}

$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) {
    throw "The Java archive checksum did not match the Adoptium release metadata."
}

New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
Expand-Archive -LiteralPath $archive -DestinationPath $extractRoot -Force
$jdkSource = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
if ($null -eq $jdkSource -or -not (Test-Path (Join-Path $jdkSource.FullName "bin\java.exe"))) {
    throw "The extracted Java installation is invalid."
}

Move-Item -LiteralPath $jdkSource.FullName -Destination $jdkTarget
Remove-Item -LiteralPath $extractRoot -Recurse
Remove-Item -LiteralPath $archive

$env:JAVA_HOME = $jdkTarget
& (Join-Path $jdkTarget "bin\java.exe") -version
Write-Host "Java is ready. Run start.cmd to start Live Desktop."
