param(
    [ValidateSet("snapshot", "set")]
    [string]$Action = "snapshot",
    [ValidateSet("wifi", "bluetooth")]
    [string]$Control = "wifi",
    [ValidateSet("on", "off")]
    [string]$Target = "on"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Result($value) {
    [Console]::Out.Write(($value | ConvertTo-Json -Compress -Depth 4))
}

function Await-WinRt($operation, $resultType) {
    $method = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq "AsTask" -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
    })[0]
    $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
    $task.Wait()
    return $task.Result
}

function Get-Radios {
    $operation = [Windows.Devices.Radios.Radio]::GetRadiosAsync()
    $type = [System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]]
    return @(Await-WinRt $operation $type)
}

function Find-Radio($radios, $control) {
    $kind = if ($control -eq "wifi") { "WiFi" } else { "Bluetooth" }
    return $radios | Where-Object { $_.Kind.ToString() -eq $kind } | Select-Object -First 1
}

function Radio-State($radios, $control) {
    $radio = Find-Radio $radios $control
    if ($null -eq $radio) {
        return [pscustomobject]@{ available = $false; enabled = $false; state = "Unavailable" }
    }
    return [pscustomobject]@{
        available = $true
        enabled = $radio.State.ToString() -eq "On"
        state = $radio.State.ToString()
    }
}

if (-not [System.Environment]::OSVersion.Platform.ToString().StartsWith("Win")) {
    Write-Result ([pscustomobject]@{ available = $false; detail = "Windows system controls are available on Windows only." })
    exit 0
}

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Devices.Radios.Radio, Windows.Devices.Radios, ContentType = WindowsRuntime]
    $radios = Get-Radios

    if ($Action -eq "snapshot") {
        Write-Result ([pscustomobject]@{
            available = $true
            wifi = Radio-State $radios "wifi"
            bluetooth = Radio-State $radios "bluetooth"
        })
        exit 0
    }

    $radio = Find-Radio $radios $Control
    if ($null -eq $radio) {
        throw "$Control radio is not available on this PC."
    }

    $access = Await-WinRt `
        ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) `
        ([Windows.Devices.Radios.RadioAccessStatus])
    if ($access.ToString() -ne "Allowed") {
        throw "Windows denied access to the $Control radio ($access)."
    }

    $targetState = if ($Target -eq "on") {
        [Windows.Devices.Radios.RadioState]::On
    } else {
        [Windows.Devices.Radios.RadioState]::Off
    }
    $result = Await-WinRt `
        ($radio.SetStateAsync($targetState)) `
        ([Windows.Devices.Radios.RadioAccessStatus])
    if ($result.ToString() -ne "Allowed") {
        throw "Windows rejected the $Control change ($result)."
    }

    Start-Sleep -Milliseconds 350
    $updated = Radio-State (Get-Radios) $Control
    $expected = $Target -eq "on"
    if (-not $updated.available -or $updated.enabled -ne $expected) {
        throw "Windows accepted the request, but the $Control radio did not reach the requested state."
    }

    Write-Result ([pscustomobject]@{
        available = $true
        control = $Control
        enabled = $updated.enabled
        state = $updated.state
        status = "completed"
    })
} catch {
    Write-Result ([pscustomobject]@{
        available = $false
        control = $Control
        detail = $_.Exception.Message
    })
    exit 1
}
