# System information access

Live Desktop's **System Info** tab reads information already exposed to the signed-in Windows user. It does not request administrator privileges, install a driver, query firmware directly, or send a separate hardware-inventory request to an external service.

## Information displayed

| UI area | Information | Local source |
| --- | --- | --- |
| Resource summary | Current CPU load, used and total physical memory | Java `OperatingSystemMXBean` |
| Resource summary | Used and total storage | Java file-system information for the drive that contains the configured `WORKSPACE_ROOT` |
| Resource summary | Processor name, physical core count, logical processor count, and maximum clock speed | Native bridge: fixed CPU registry data, processor topology APIs, `CallNtPowerInformation` |
| Resource summary and device specifications | Graphics adapter name and driver version | Native bridge: DXGI adapter inspection |
| Device specifications | Device name | Windows `COMPUTERNAME` environment value |
| Device specifications | Manufacturer, model, installed physical memory, and system type | Native bridge: fixed BIOS registry keys, physical memory and native system APIs |
| Device specifications | Windows Product ID | `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProductId` |
| Device specifications | Windows Device ID | `HKLM\SOFTWARE\Microsoft\SQMClient\MachineId` |
| Windows specifications | Edition, underlying OS version, build number, install date, and architecture | Native bridge: Windows NT CurrentVersion registry data and native architecture API; install date is registry-reported |
| Windows specifications | Display version and update build revision | `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion` |
| Live system status | Active non-loopback network name and local IPv4 address | Java `NetworkInterface` |
| Live system status | Battery percentage and charging state, when Windows exposes a battery | Native bridge: `GetSystemPowerStatus` |
| Live system status | Wi-Fi and Bluetooth availability and state | Windows Runtime radio API |
| Live system status | Backend connection, OpenAI configuration state, Java runtime version, and capture time | Live Desktop health/runtime state and Java system properties |

The storage figures describe one volume: the drive containing `WORKSPACE_ROOT`, not every attached disk. Graphics adapter memory is not displayed. DXGI driver versions and registry install dates can differ in formatting or meaning from former CIM fields; unavailable native values are not fabricated.

## Collection behavior

- Stable device and Windows specifications are collected during backend startup and cached in memory.
- CPU, memory, storage, network, service, and capture-time values are refreshed with each dashboard snapshot. Battery reads are warmed during startup and cached for up to five minutes; successful radio snapshots are cached for 30 seconds. Native radio handles have a separate 30-second enumeration cache, so adapter changes can take about 60 seconds. A dashboard radio change updates its state cache immediately.
- Windows integrations share a backend-owned C++ bridge, with fixed read-only registry queries and supported native APIs. There is no PowerShell fallback. A restricted Windows account may return `Unavailable` for fields Windows does not expose. A later request can reconnect after bridge failure, without replaying failed mutations.
- On non-Windows systems, or when the Windows query fails or times out, the endpoint returns limited Java runtime information and marks Windows-only fields as unavailable.
- The page's **Copy system info** button copies the visible specifications to the local clipboard only after the user clicks it.

## Data flow and privacy

`GET /api/system` returns these details to the local browser UI. The backend binds to `127.0.0.1:4317` by default, and no device inventory is persisted to the repository or the `data` directory.

The assistant's automatic system context remains intentionally smaller than the System Info page. It includes the device name, Windows name/version, architecture, resource usage, network/battery state, and system-control availability when a prompt is about the PC. It does **not** include the Windows Device ID, Windows Product ID, manufacturer, model, processor name, graphics driver, or Windows install date. Those identifiers remain in the local `/api/system` response and UI unless the user manually copies or mentions them.

The Product ID is the Windows installation identifier displayed by Windows Settings; it is not the Windows product key. Live Desktop never reads or displays a Windows product key.
