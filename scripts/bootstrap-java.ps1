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

# Pinned Temurin release. Update the version, URL and hash together and deliberately, after checking the hash
# against the release's .sha256.txt on github.com/adoptium/temurin21-binaries. The hash is never read from a
# server at run time, so a spoofed or compromised metadata endpoint cannot choose both the file and its checksum.
$jdkRelease = "jdk-21.0.13.1+2"
$downloadUrl = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13.1%2B2/OpenJDK21U-jdk_x64_windows_hotspot_21.0.13.1_2.zip"
$expectedHash = "bbebea1469996b276683c9299c227b294f85c847039c82633218186a4ad4fbf2"

Write-Host "Downloading Temurin $jdkRelease..."
curl.exe -L --fail --proto "=https" --output $archive $downloadUrl
if ($LASTEXITCODE -ne 0) {
    throw "The Java download failed."
}

$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) {
    Remove-Item -LiteralPath $archive -Force
    throw "The Java archive checksum did not match the SHA-256 pinned in bootstrap-java.ps1."
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
