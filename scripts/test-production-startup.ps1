$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testParent = (Resolve-Path -LiteralPath (Join-Path $projectRoot 'backend\target')).Path
$testRoot = Join-Path $testParent ('startup-test-' + [Guid]::NewGuid().ToString('N'))
$launcher = Join-Path $testRoot 'native\build\Release\live-desktop-launcher.exe'
$savedJava = $env:JAVA_HOME
$savedData = $env:DATA_DIR
$sentinel = $null

function Assert-True($condition, $message) { if (-not $condition) { throw $message } }
function Invoke-Launcher([string]$action) {
    & $launcher $action --root $testRoot
    Assert-True ($LASTEXITCODE -eq 0) "Launcher $action failed."
}
function Read-Children {
    $matches = [regex]::Matches((Get-Content -LiteralPath (Join-Path $testRoot '.launcher.log') -Raw), 'Backend PID (\d+), frontend PID (\d+)')
    $last = $matches[$matches.Count - 1]
    return @([int]$last.Groups[1].Value, [int]$last.Groups[2].Value)
}
function Wait-Stopped($ids) {
    $deadline = [DateTime]::UtcNow.AddSeconds(12)
    do {
        $remaining = @($ids | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
        if ($remaining.Count -eq 0) { return }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Owned service processes survived cleanup.'
}
try {
    foreach ($folder in @('native\build\Release', 'backend\target', 'frontend\scripts', 'frontend\dist')) {
        New-Item -ItemType Directory -Path (Join-Path $testRoot $folder) -Force | Out-Null
    }
    foreach ($name in @('live-desktop-launcher.exe', 'live-desktop-windows-bridge.exe', 'live-desktop-credentials.dll')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot "native\build\Release\$name") -Destination (Join-Path $testRoot "native\build\Release\$name")
    }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'backend\target\live-desktop-backend.jar') -Destination (Join-Path $testRoot 'backend\target')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend\dist\client') -Destination (Join-Path $testRoot 'frontend\dist') -Recurse
    Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend\scripts\serve-production.mjs') -Destination (Join-Path $testRoot 'frontend\scripts')
    $env:JAVA_HOME = (Resolve-Path -LiteralPath (Join-Path $projectRoot '.tools\jdk-21')).Path
    $env:DATA_DIR = Join-Path $testRoot 'data'
    Invoke-Launcher start
    $first = Read-Children
    Invoke-Launcher start
    $duplicate = Read-Children
    Assert-True (($duplicate -join ',') -eq ($first -join ',')) 'Duplicate start created new services.'
    $health = Invoke-RestMethod http://127.0.0.1:4173/health
    Assert-True ($null -ne $health) 'Frontend health proxy failed.'
    Invoke-Launcher restart
    $second = Read-Children
    Assert-True (($second -join ',') -ne ($first -join ',')) 'Restart did not replace services.'
    Wait-Stopped $first
    Invoke-Launcher shutdown
    Wait-Stopped $second
    Invoke-Launcher shutdown

    $requests = @()
    1..2 | ForEach-Object {
        $requests += Start-Process -FilePath $launcher -ArgumentList @('start', '--root', ('"' + $testRoot + '"')) -WindowStyle Hidden -PassThru
    }
    foreach ($request in $requests) { Assert-True ($request.WaitForExit(70000)) 'Concurrent start timed out.'; Assert-True ($request.ExitCode -eq 0) 'Concurrent start failed.' }
    $apiBefore = Read-Children
    $apiRestart = Invoke-RestMethod -Method Post http://127.0.0.1:4173/api/runtime/restart
    Assert-True ($apiRestart.status -eq 'accepted') 'Dashboard restart was not accepted.'
    # The launcher waits for readiness again after the request cleared its readiness event.
    Invoke-Launcher start
    $apiAfter = Read-Children
    Assert-True (($apiBefore -join ',') -ne ($apiAfter -join ',')) 'Dashboard restart did not replace services.'
    Wait-Stopped $apiBefore
    $apiShutdown = Invoke-RestMethod -Method Post http://127.0.0.1:4173/api/runtime/shutdown
    Assert-True ($apiShutdown.status -eq 'accepted') 'Dashboard shutdown was not accepted.'
    Wait-Stopped $apiAfter
    Invoke-Launcher shutdown

    # Sentinel listener is created by this test and must survive a failed start.
    $sentinelScript = Join-Path $testRoot 'sentinel.cjs'
    Set-Content -LiteralPath $sentinelScript -Value "require('node:http').createServer((q,s)=>{s.setHeader('content-type','text/plain');s.end('sentinel')}).listen(4173,'127.0.0.1');"
    $nodePath = (Get-Command node).Source
    $sentinel = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $sentinelScript + '"')) -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $testRoot 'sentinel.err.log')
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        try { $body = (Invoke-WebRequest http://127.0.0.1:4173 -TimeoutSec 1).Content } catch { $body = '' }
        if ($body -eq 'sentinel') { break }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($body -ne 'sentinel') { Get-Content -LiteralPath (Join-Path $testRoot 'sentinel.err.log'); throw 'Sentinel did not start.' }
    & $launcher start --root $testRoot
    Assert-True ($LASTEXITCODE -ne 0) 'Occupied port was accepted.'
    Assert-True ((Invoke-WebRequest http://127.0.0.1:4173).Content -eq 'sentinel') 'Unrelated listener was killed.'
    Stop-Process -InputObject $sentinel -Force; $sentinel.WaitForExit(); $sentinel = $null

    Invoke-Launcher start
    $third = Read-Children
    # Terminate only the frontend this test launched; the supervisor must clean up its backend.
    Stop-Process -Id $third[1] -Force
    Wait-Stopped $third
    & $launcher status --root $testRoot
    Assert-True ($LASTEXITCODE -eq 2) 'Supervisor survived service failure.'

    Invoke-Launcher start
    $fourth = Read-Children
    Invoke-RestMethod http://127.0.0.1:4173/api/system | Out-Null
    $bridges = @(Get-CimInstance Win32_Process -Filter "Name = 'live-desktop-windows-bridge.exe'" | Where-Object ParentProcessId -eq $fourth[0] | ForEach-Object { [int]$_.ProcessId })
    Assert-True ($bridges.Count -gt 0) 'Backend bridge descendant was not observed.'
    $supervisorMatches = [regex]::Matches((Get-Content -LiteralPath (Join-Path $testRoot '.launcher.log') -Raw), 'Supervisor PID (\d+)')
    $supervisorId = [int]$supervisorMatches[$supervisorMatches.Count - 1].Groups[1].Value
    Stop-Process -Id $supervisorId -Force
    Wait-Stopped ($fourth + $bridges)
    $jar = Join-Path $testRoot 'backend\target\live-desktop-backend.jar'
    Move-Item -LiteralPath $jar -Destination ($jar + '.missing')
    & $launcher start --root $testRoot
    Assert-True ($LASTEXITCODE -ne 0) 'Missing packaged backend was accepted.'
    Write-Output 'PASS: duplicate/concurrent start, HTTP proxy, CLI/API restart/shutdown, occupied-port isolation, service failure, supervisor termination with bridge cleanup, missing artifact.'
} finally {
    if ($sentinel -and -not $sentinel.HasExited) { Stop-Process -InputObject $sentinel -Force }
    if (Test-Path -LiteralPath $launcher) { & $launcher shutdown --root $testRoot }
    if (Test-Path -LiteralPath (Join-Path $testRoot '.launcher.log')) { Get-Content -LiteralPath (Join-Path $testRoot '.launcher.log') }
    $env:JAVA_HOME = $savedJava; $env:DATA_DIR = $savedData
    # Verify the absolute deletion target stays within the designated test parent.
    $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
    if ($resolvedTestRoot.StartsWith($testParent + '\', [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
