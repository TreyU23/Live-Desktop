# Read-only native integration test. Never changes radio/media state or opens an app.
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$executable = Join-Path $projectRoot "native\build\Release\live-desktop-windows-bridge.exe"
if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Build the Windows bridge first." }
$pipeName = "LiveDesktop.WindowsBridge." + [Guid]::NewGuid().ToString()
$startup = [Diagnostics.Stopwatch]::StartNew()
$bridge = Start-Process -FilePath $executable -ArgumentList @("--pipe", "\\.\pipe\$pipeName", "--parent-pid", "$PID") -WindowStyle Hidden -PassThru
$pipe = [IO.Pipes.NamedPipeClientStream]::new(".", $pipeName, [IO.Pipes.PipeDirection]::InOut)
try {
    $pipe.Connect(3000)
    $reader = [IO.StreamReader]::new($pipe, [Text.UTF8Encoding]::new($false), $false, 1024, $true)
    $writer = [IO.StreamWriter]::new($pipe, [Text.UTF8Encoding]::new($false), 1024, $true)
    $writer.AutoFlush = $true
    function Invoke-BridgeRead($operation, $version = 1, $arguments = @{}) {
        $requestId = [Guid]::NewGuid().ToString()
        $writer.WriteLine((@{protocolVersion=$version; requestId=$requestId; operation=$operation; arguments=$arguments} | ConvertTo-Json -Compress))
        $pending = $reader.ReadLineAsync()
        if (-not $pending.Wait(12000)) { throw "Bridge response timed out." }
        $result = $pending.Result | ConvertFrom-Json
        if ($result.requestId -ne $requestId -or $result.protocolVersion -ne 1) { throw "Invalid response envelope." }
        return $result
    }
    $health = Invoke-BridgeRead "bridge.health"
    if (-not $health.ok -or $health.result.status -ne "ok") { throw "Bridge health failed." }
    $startup.Stop()
    $connectAndHealthMs = $startup.Elapsed.TotalMilliseconds
    $startup.Start()
    $capabilities = Invoke-BridgeRead 'bridge.capabilities'
    if (-not $capabilities.ok -or $capabilities.result.operations -notcontains 'media.artwork') { throw 'Artwork operation missing from capability inventory.' }
    if ((Invoke-BridgeRead "unregistered.operation").ok) { throw "Unknown operation was accepted." }
    if ((Invoke-BridgeRead "bridge.health" 2).ok) { throw "Unsupported protocol was accepted." }
    foreach ($operation in @('power.snapshot','system.staticSnapshot','process.knownApps','phoneLink.snapshot')) {
        $response = Invoke-BridgeRead $operation
        if (-not $response.ok) { throw "$operation failed: $($response.error.code)" }
    }
    foreach ($provider in @('music','apple','spotify')) {
        $media = Invoke-BridgeRead 'media.snapshot' 1 @{provider=$provider}
        if (-not $media.ok -or $null -eq $media.result.title) { throw "Media snapshot contract failed for $provider." }
    }
    if ((Invoke-BridgeRead 'windows.openUri' 1 @{uri='file:///C:/Windows'}).ok) { throw 'Non-allowlisted URI was accepted.' }
    if ((Invoke-BridgeRead 'browser.openUrl' 1 @{uri='javascript:alert(1)'}).ok) { throw 'Invalid browser scheme was accepted.' }
    $timings = @(1..10 | ForEach-Object {
        $watch = [Diagnostics.Stopwatch]::StartNew()
        $result = Invoke-BridgeRead "radio.snapshot"
        $watch.Stop()
        if (-not $result.ok) { throw "Radio snapshot failed: $($result.error.code) $($result.error.message)" }
        if ($null -eq $result.result.wifi -or $null -eq $result.result.bluetooth) { throw "Snapshot contract is incomplete." }
        if ($_ -eq 1) { $startup.Stop(); $launchThroughIntegrationChecksMs = $startup.Elapsed.TotalMilliseconds }
        $watch.Elapsed.TotalMilliseconds
    })
    [pscustomobject]@{ConnectAndHealthMs=$connectAndHealthMs; LaunchThroughIntegrationChecksMs=$launchThroughIntegrationChecksMs; SnapshotMeanMs=($timings | Measure-Object -Average).Average; SubsequentSnapshotMeanMs=($timings[1..9] | Measure-Object -Average).Average; SnapshotMaxMs=($timings | Measure-Object -Maximum).Maximum; Samples=$timings.Count; RadioChanges=0}
} finally {
    if ($writer) { $writer.Dispose() }
    if ($reader) { $reader.Dispose() }
    $pipe.Dispose()
    if (-not $bridge.HasExited) { Stop-Process -Id $bridge.Id -ErrorAction SilentlyContinue }
}
