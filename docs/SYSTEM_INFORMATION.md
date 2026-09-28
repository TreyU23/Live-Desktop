# System information access

Live Desktop's **System Info** tab reads information already exposed to the signed-in Windows user. It does not request administrator privileges, install a driver, query firmware directly, or send a separate hardware-inventory request to an external service.

## Information displayed

| UI area | Information | Local source |
| --- | --- | --- |
| Resource summary | Current CPU load, used and total physical memory | Java `OperatingSystemMXBean` |
| Resource summary | Used and total storage | Java file-system information for the drive that contains the configured `WORKSPACE_ROOT` |
| Resource summary | Processor name, physical core count, logical processor count, and maximum clock speed | Windows CIM `Win32_Processor` |
| Resource summary and device specifications | Graphics adapter name and driver version | Windows CIM `Win32_VideoController` |
| Device specifications | Device name | Windows `COMPUTERNAME` environment value |
| Device specifications | Manufacturer, model, installed physical memory, and system type | Windows CIM `Win32_ComputerSystem` |
| Device specifications | Windows Product ID | `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProductId` |
| Device specifications | Windows Device ID | `HKLM\SOFTWARE\Microsoft\SQMClient\MachineId` |
| Windows specifications | Edition, underlying OS version, build number, install date, and architecture | Windows CIM `Win32_OperatingSystem` |
| Windows specifications | Display version and update build revision | `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion` |
| Live system status | Active non-loopback network name and local IPv4 address | Java `NetworkInterface` |
| Live system status | Battery percentage and charging state, when Windows exposes a battery | Windows CIM `Win32_Battery` |
| Live system status | Wi-Fi and Bluetooth availability and state | Windows Runtime radio API |
| Live system status | Backend connection, OpenAI configuration state, Java runtime version, and capture time | Live Desktop health/runtime state and Java system properties |

The storage figures describe one volume: the drive containing `WORKSPACE_ROOT`. They are not an inventory of every attached disk. Graphics adapter memory is intentionally not displayed because `Win32_VideoController.AdapterRAM` can differ from the value shown by Windows Settings on integrated graphics.

## Collection behavior

- Stable device and Windows specifications are collected during backend startup and cached in memory.
- CPU, memory, storage, network, service, and capture-time values are refreshed with each dashboard snapshot. Slow Windows battery reads are warmed during backend startup and cached for up to five minutes; radio snapshots are cached for up to 30 seconds. Radio snapshots and changes share a backend-owned Windows Runtime worker so routine requests do not repeatedly start PowerShell; a failed worker falls back to a one-shot request. A Wi-Fi or Bluetooth change made through Live Desktop updates the radio cache immediately.
- The backend uses non-interactive Windows PowerShell with CIM and read-only registry access. A restricted Windows account may return `Unavailable` for fields Windows does not expose.
- On non-Windows systems, or when the Windows query fails or times out, the endpoint returns limited Java runtime information and marks Windows-only fields as unavailable.
- The page's **Copy system info** button copies the visible specifications to the local clipboard only after the user clicks it.

## Data flow and privacy

`GET /api/system` returns these details to the local browser UI. The backend binds to `127.0.0.1:4317` by default, and no device inventory is persisted to the repository or the `data` directory.

The assistant's automatic system context remains intentionally smaller than the System Info page. It includes the device name, Windows name/version, architecture, resource usage, network/battery state, and system-control availability when a prompt is about the PC. It does **not** include the Windows Device ID, Windows Product ID, manufacturer, model, processor name, graphics driver, or Windows install date. Those identifiers remain in the local `/api/system` response and UI unless the user manually copies or mentions them.

The Product ID is the Windows installation identifier displayed by Windows Settings; it is not the Windows product key. Live Desktop never reads or displays a Windows product key.
