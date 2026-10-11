param([ValidateRange(10,100)][int]$Pairs = 10, [switch]$Aot, [string]$BuildDirectory = 'backend/target')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$java = Join-Path $projectRoot '.tools/jdk-21/bin/java.exe'
$artifacts = [IO.Path]::GetFullPath((Join-Path $projectRoot $BuildDirectory))
$output = Join-Path $projectRoot 'backend/target/performance'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$data = Join-Path $output ('layout-data-' + [Guid]::NewGuid().ToString('N'))
$results = @()
$label = if ($Aot) { 'aot' } else { 'jvm' }
$completed = $false
if (Get-NetTCPConnection -State Listen -LocalPort 4317 -ErrorAction SilentlyContinue) { throw 'Port 4317 must be free before comparing startup layouts.' }
try {
foreach ($pair in 1..$Pairs) {
    $layouts = if ($pair % 2) { @('jar','extracted','cds') } else { @('cds','extracted','jar') }
    foreach ($layout in $layouts) {
        $working = if ($layout -eq 'jar') { Join-Path $projectRoot 'backend' } else { Join-Path $artifacts 'runtime' }
        $options = @()
        if ($Aot) { $options += '-Dspring.aot.enabled=true' }
        if ($layout -eq 'cds') { $options += @('-Xshare:on', '-XX:SharedArchiveFile=application.jsa') }
        $jar = if ($layout -eq 'jar') { '"' + (Join-Path $artifacts 'live-desktop-backend.jar') + '"' } else { 'live-desktop-backend.jar' }
        $options += @('-jar', $jar, '--spring.config.import=', '--assistant.openai-api-key=', ('"--assistant.data-dir=' + $data + '"'), ('"--assistant.workspace-root=' + $projectRoot + '"'))
        $watch = [Diagnostics.Stopwatch]::StartNew()
        $logPrefix = "$label-$pair-$layout"
        $process = Start-Process -FilePath $java -ArgumentList $options -WorkingDirectory $working -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $output "$logPrefix.out.log") -RedirectStandardError (Join-Path $output "$logPrefix.err.log")
        try {
            $ready = $false
            while ($watch.Elapsed.TotalSeconds -lt 60 -and -not $process.HasExited) {
                try { $response = Invoke-WebRequest 'http://127.0.0.1:4317/health' -TimeoutSec 1; $ready = $response.StatusCode -eq 200 } catch { }
                if ($ready) { break }; Start-Sleep -Milliseconds 50
            }
            if (-not $ready) { throw "Layout $layout failed. See backend/target/performance/$logPrefix.err.log" }
            $readiness = $watch.Elapsed.TotalMilliseconds
            $firstUse = [Diagnostics.Stopwatch]::StartNew()
            Invoke-WebRequest 'http://127.0.0.1:4317/api/system' -Headers @{ 'X-Profile-Id' = 'synthetic' } -TimeoutSec 20 | Out-Null
            $firstUse.Stop(); $process.Refresh()
            $results += [ordered]@{ pair = $pair; layout = $layout; aot = [bool]$Aot; readinessMs = $readiness; firstSystemMs = $firstUse.Elapsed.TotalMilliseconds; workingSetBytes = $process.WorkingSet64 }
        } finally { if (-not $process.HasExited) { Stop-Process -InputObject $process -Force; $process.WaitForExit() } }
    }
}
$completed = $true
} finally {
    try {
        $resultName = if ($completed) { "$label-layouts.json" } else { "$label-layouts.partial.json" }
        ConvertTo-Json -InputObject @($results) -Depth 4 | Set-Content -LiteralPath (Join-Path $output $resultName)
    } finally {
        $resolvedData = [IO.Path]::GetFullPath($data)
        if ($resolvedData.StartsWith($output + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedData)) { Remove-Item -LiteralPath $resolvedData -Recurse -Force }
    }
}
