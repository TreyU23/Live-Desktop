$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localJdk = Join-Path $projectRoot '.tools\jdk-21'
if (Test-Path -LiteralPath (Join-Path $localJdk 'bin\java.exe')) { $env:JAVA_HOME = $localJdk }
$env:MAVEN_USER_HOME = Join-Path $projectRoot '.tools\maven-home'
Push-Location $projectRoot
try {
    & "$PSScriptRoot\build-windows-bridge.ps1"
    & '.\mvnw.cmd' -pl backend package
    if ($LASTEXITCODE -ne 0) { throw 'Backend package failed.' }
    & "$PSScriptRoot\prepare-backend-runtime.ps1" -Cds
    & npm --prefix frontend test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
    & npm --prefix frontend run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
Write-Output 'Production artifacts built. Run start.cmd.'
