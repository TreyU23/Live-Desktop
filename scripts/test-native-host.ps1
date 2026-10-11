$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & node --test native/tests/host.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Native frontend host tests failed.' }
} finally { Pop-Location }
