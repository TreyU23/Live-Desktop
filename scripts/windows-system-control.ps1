param(
    [ValidateSet("snapshot", "set", "worker")]
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

function Write-WorkerResult($value) {
    [Console]::Out.WriteLine(($value | ConvertTo-Json -Compress -Depth 4))
    [Console]::Out.Flush()
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

function Invoke-Control($action, $control, $target) {
    try {
        if ($null -eq $script:Radios) {
            $script:Radios = @(Get-Radios)
        }

        if ($action -eq "snapshot") {
            return [pscustomobject]@{
                available = $true
                wifi = Radio-State $script:Radios "wifi"
                bluetooth = Radio-State $script:Radios "bluetooth"
            }
        }

        $radio = Find-Radio $script:Radios $control
        if ($null -eq $radio) {
            $script:Radios = @(Get-Radios)
            $radio = Find-Radio $script:Radios $control
        }
        if ($null -eq $radio) {
            throw "$control radio is not available on this PC."
        }

        $access = Await-WinRt `
            ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) `
            ([Windows.Devices.Radios.RadioAccessStatus])
        if ($access.ToString() -ne "Allowed") {
            throw "Windows denied access to the $control radio ($access)."
        }

        $targetState = if ($target -eq "on") {
            [Windows.Devices.Radios.RadioState]::On
        } else {
            [Windows.Devices.Radios.RadioState]::Off
        }
        $result = Await-WinRt `
            ($radio.SetStateAsync($targetState)) `
            ([Windows.Devices.Radios.RadioAccessStatus])
        if ($result.ToString() -ne "Allowed") {
            throw "Windows rejected the $control change ($result)."
        }

        $expected = $target -eq "on"
        $expectedState = if ($expected) { "On" } else { "Off" }
        $verification = [System.Diagnostics.Stopwatch]::StartNew()
        while ($radio.State.ToString() -ne $expectedState -and $verification.ElapsedMilliseconds -lt 1500) {
            Start-Sleep -Milliseconds 50
        }
        $updatedState = $radio.State.ToString()
        if ($updatedState -ne $expectedState) {
            throw "Windows accepted the request, but the $control radio did not reach the requested state."
        }

        return [pscustomobject]@{
            available = $true
            control = $control
            enabled = $expected
            state = $updatedState
            status = "completed"
        }
    } catch {
        return [pscustomobject]@{
            available = $false
            control = $control
            detail = $_.Exception.Message
        }
    }
}

if (-not [System.Environment]::OSVersion.Platform.ToString().StartsWith("Win")) {
    Write-Result ([pscustomobject]@{ available = $false; detail = "Windows system controls are available on Windows only." })
    exit 0
}

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Devices.Radios.Radio, Windows.Devices.Radios, ContentType = WindowsRuntime]
    $script:Radios = $null

    if ($Action -eq "worker") {
        while ($null -ne ($line = [Console]::In.ReadLine())) {
            try {
                $request = $line | ConvertFrom-Json
                $response = Invoke-Control ([string]$request.action) ([string]$request.control) ([string]$request.target)
            } catch {
                $response = [pscustomobject]@{ available = $false; detail = $_.Exception.Message }
            }
            Write-WorkerResult $response
        }
        exit 0
    }

    $response = Invoke-Control $Action $Control $Target
    Write-Result $response
    if (-not $response.available) { exit 1 }
} catch {
    Write-Result ([pscustomobject]@{
        available = $false
        control = $Control
        detail = $_.Exception.Message
    })
    exit 1
}
