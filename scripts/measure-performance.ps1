param([ValidateRange(1,100)][int]$Launches = 10, [string]$Label = 'candidate', [string]$OutputDirectory = 'backend/target/performance')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$output = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
New-Item -ItemType Directory -Path $output -Force | Out-Null
$stage = Join-Path $output ('runtime-' + [Guid]::NewGuid().ToString('N'))
$savedData = $env:DATA_DIR
$savedJava = $env:JAVA_HOME
$savedOptions = $env:JAVA_TOOL_OPTIONS
$savedKey = $env:OPENAI_API_KEY
$launcher = Join-Path $stage 'native/build/Release/live-desktop-launcher.exe'
try {
    foreach ($relative in @('native/build/Release', 'backend/target', 'frontend/dist')) {
        New-Item -ItemType Directory -Path (Join-Path $stage $relative) -Force | Out-Null
    }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'native/build/Release') -Destination (Join-Path $stage 'native/build') -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'backend/target/live-desktop-backend.jar') -Destination (Join-Path $stage 'backend/target')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'backend/target/runtime') -Destination (Join-Path $stage 'backend/target') -Recurse
    Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend/dist/client') -Destination (Join-Path $stage 'frontend/dist') -Recurse
    $env:DATA_DIR = Join-Path $stage 'data'
    $env:JAVA_HOME = Join-Path $projectRoot '.tools/jdk-21'
    $env:OPENAI_API_KEY = ''
    $env:JAVA_TOOL_OPTIONS = ''
    $raw = @()
    for ($iteration = 1; $iteration -le $Launches; $iteration++) {
        & $launcher start --root $stage | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Benchmark launch $iteration failed." }
        $raw += [ordered]@{ label = $Label; iteration = $iteration; metrics = @(Get-Content -LiteralPath (Join-Path $stage '.startup-metrics.jsonl') | ForEach-Object { $_ | ConvertFrom-Json })[-1] }
        if ($iteration -eq 1) {
            $routes = @()
            foreach ($route in @('/health','/api/actions','/api/memories','/api/conversations','/api/system','/api/system/apps','/api/integrations/phone-link','/api/integrations/media-session')) {
                foreach ($port in @(4317,4173)) {
                    for ($sample = 0; $sample -lt 100; $sample++) {
                        $watch = [Diagnostics.Stopwatch]::StartNew()
                        $response = Invoke-WebRequest "http://127.0.0.1:$port$route" -Headers @{ 'X-Profile-Id' = 'perf-synthetic' }
                        $watch.Stop()
                        $routes += [ordered]@{ route = $route; port = $port; milliseconds = $watch.Elapsed.TotalMilliseconds; bytes = [Text.Encoding]::UTF8.GetByteCount($response.Content) }
                    }
                }
            }
            $routes | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $output "$Label-routes.json")
        }
        & $launcher shutdown --root $stage | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Benchmark shutdown failed.' }
    }
    $javaVersion = & (Join-Path $env:JAVA_HOME 'bin/java.exe') -version 2>&1 | Out-String
    $artifactHashes = @(foreach ($relative in @('native/build/Release', 'backend/target/runtime', 'frontend/dist/client')) {
        Get-ChildItem -LiteralPath (Join-Path $stage $relative) -Recurse -File | ForEach-Object {
            [ordered]@{ path = $_.FullName.Substring($stage.Length + 1).Replace('\', '/'); sha256 = (Get-FileHash -LiteralPath $_.FullName).Hash }
        }
    })
    [ordered]@{ label = $Label; source = (git -C $projectRoot rev-parse HEAD); java = $javaVersion; cpu = (Get-CimInstance Win32_Processor).Name; power = (powercfg /getactivescheme | Out-String); jarSha256 = (Get-FileHash (Join-Path $stage 'backend/target/live-desktop-backend.jar')).Hash; artifactHashes = $artifactHashes; launches = $raw; conditions = 'Fresh processes, warm filesystem cache, isolated synthetic profiles, no credentials; host power state not controlled.' } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $output "$Label-startup.json")
} finally {
    if (Test-Path -LiteralPath $launcher) { & $launcher shutdown --root $stage | Out-Null }
    $env:DATA_DIR = $savedData; $env:JAVA_HOME = $savedJava; $env:JAVA_TOOL_OPTIONS = $savedOptions; $env:OPENAI_API_KEY = $savedKey
    $resolved = [IO.Path]::GetFullPath($stage)
    if ($resolved.StartsWith($output + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
