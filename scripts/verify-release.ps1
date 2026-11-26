<#
.SYNOPSIS
Checks a downloaded Live Desktop ZIP against the hash recorded in its signed release tag.

.DESCRIPTION
The .sha256 file in a GitHub release sits next to the ZIP, so anyone who can replace one can replace
the other. From 3.0.3 the ZIP's SHA-256 is also written into the annotated release tag, and the tag
is SSH-signed with the maintainer's key on the release PC (issue #12). This script asks GitHub for
the tag, requires GitHub to report its signature as verified, and compares the hash in the tag
message with the local file.

.EXAMPLE
.\scripts\verify-release.ps1 -Zip .\Live-Desktop-windows-x64.zip -Tag v3.0.4
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Zip,
    [Parameter(Mandatory)][string]$Tag,
    [string]$Repository = 'TreyU23/Live-Desktop'
)

$ErrorActionPreference = 'Stop'
$kAssetName = 'Live-Desktop-windows-x64.zip'

if ($Tag -notmatch '^v\d+\.\d+\.\d+$') { throw "Expected a release tag such as v3.0.3, got '$Tag'." }
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw "Expected owner/name, got '$Repository'." }
if (-not (Test-Path -LiteralPath $Zip -PathType Leaf)) { throw "ZIP not found: $Zip" }

$headers = @{ 'User-Agent' = 'live-desktop-verify-release'; Accept = 'application/vnd.github+json' }
$api = "https://api.github.com/repos/$Repository/git"

$ref = Invoke-RestMethod -Uri "$api/ref/tags/$Tag" -Headers $headers
if ($ref.object.type -ne 'tag') { throw "$Tag is a lightweight tag; only annotated, signed tags record the ZIP hash." }

$tagObject = Invoke-RestMethod -Uri "$api/tags/$($ref.object.sha)" -Headers $headers
if (-not $tagObject.verification.verified) {
    throw "GitHub does not verify the signature on $Tag (reason: $($tagObject.verification.reason))."
}

$pattern = '(?m)^' + [regex]::Escape($kAssetName) + ' SHA-256: ([0-9a-f]{64})\s*$'
$match = [regex]::Match($tagObject.message, $pattern)
if (-not $match.Success) { throw "$Tag does not record a ZIP hash. Releases before 3.0.3 only have the .sha256 asset." }

$expected = $match.Groups[1].Value
$actual = (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
    throw "MISMATCH: $Zip has SHA-256 $actual, but the signed $Tag tag records $expected. Do not run this ZIP."
}

Write-Output "OK: $Zip matches the hash in the signed $Tag tag ($expected), signed by $($tagObject.tagger.name)."
