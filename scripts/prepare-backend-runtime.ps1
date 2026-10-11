param([switch]$Cds, [string]$BuildDirectory = 'backend/target')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$java = Join-Path $projectRoot '.tools/jdk-21/bin/java.exe'
if (-not (Test-Path -LiteralPath $java)) { $java = Join-Path $env:JAVA_HOME 'bin/java.exe' }
$artifactRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot $BuildDirectory))
$runtime = Join-Path $artifactRoot 'runtime'
$allowedArtifacts = [IO.Path]::GetFullPath((Join-Path $projectRoot 'backend/target'))
if ($artifactRoot -ne $allowedArtifacts -and -not $artifactRoot.StartsWith($allowedArtifacts + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Backend artifacts must stay under backend/target.' }
if (Test-Path -LiteralPath $runtime) {
    $resolved = [IO.Path]::GetFullPath($runtime)
    $allowed = [IO.Path]::GetFullPath((Join-Path $projectRoot 'backend/target')) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid runtime build directory.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
& $java '-Djarmode=tools' -jar (Join-Path $artifactRoot 'live-desktop-backend.jar') extract --destination $runtime
if ($LASTEXITCODE -ne 0) { throw 'Backend runtime extraction failed.' }
if ($Cds) {
    $training = Join-Path $projectRoot ('backend/target/cds-training-' + [Guid]::NewGuid().ToString('N'))
    Push-Location $runtime
    try {
        & $java '-XX:ArchiveClassesAtExit=application.jsa' '-Dspring.context.exit=onRefresh' -jar live-desktop-backend.jar '--spring.config.import=' '--assistant.openai-api-key=' "--assistant.data-dir=$training" "--assistant.workspace-root=$training" *> (Join-Path $runtime 'cds-training.log')
        if ($LASTEXITCODE -ne 0) { throw 'Isolated CDS training failed.' }
        $release = Join-Path (Split-Path (Split-Path $java)) 'release'
        Copy-Item -LiteralPath $release -Destination (Join-Path $runtime 'cds-java-release.txt')
        [ordered]@{ javaReleaseSha256 = (Get-FileHash $release).Hash; applicationSha256 = (Get-FileHash 'live-desktop-backend.jar').Hash; options = @('-Xshare:auto', '-XX:SharedArchiveFile=application.jsa') } | ConvertTo-Json | Set-Content (Join-Path $runtime 'cds-identity.json')
        Move-Item -LiteralPath (Join-Path $runtime 'cds-training.log') -Destination (Join-Path $projectRoot 'backend/target/cds-training.log') -Force
    } finally {
        Pop-Location
        $resolvedTraining = [IO.Path]::GetFullPath($training)
        if ($resolvedTraining.StartsWith([IO.Path]::GetFullPath((Join-Path $projectRoot 'backend/target')) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTraining)) { Remove-Item -LiteralPath $resolvedTraining -Recurse -Force }
    }
}
