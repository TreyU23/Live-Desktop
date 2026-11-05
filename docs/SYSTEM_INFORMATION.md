# System information

System Info reads information available to the signed-in Windows user, without administrator elevation, drivers or separate external inventory requests.

| Information | Local source |
| --- | --- |
| CPU load; physical memory used/total | Java `OperatingSystemMXBean` |
| Storage used/total | Volume containing `WORKSPACE_ROOT`, not all disks |
| CPU name/cores/logical processors/max clock | Native fixed registry/topology/power APIs |
| Graphics adapter/driver | DXGI; graphics memory is not displayed |
| Device name | `COMPUTERNAME` |
| Manufacturer/model/installed RAM/system type | Native BIOS registry/memory/system APIs |
| Windows Product ID | Windows NT CurrentVersion `ProductId`; not the product key |
| Windows Device ID | SQMClient `MachineId` |
| Windows edition/version/build/install date/architecture | Native CurrentVersion registry/system APIs |
| Active network name/local IPv4 | Java `NetworkInterface` |
| Network/disk byte rates | Bridge `system.ioCounters` cumulative counters; Java derives B/s between snapshots |
| Battery/charging | `GetSystemPowerStatus`, when available |
| Wi-Fi/Bluetooth | WinRT radio APIs |
| Backend/key availability/Java version/capture time | Application health/runtime and Java properties |

Stable specifications cache for backend lifetime. CPU/memory/storage/network refresh per snapshot; network/disk throughput rates stay unavailable until a second sample arrives within 1s–5min; battery caches 5 minutes and radio snapshots 30 seconds. Native radio enumeration separately caches 30 seconds, so adapter changes may take roughly 60 seconds. Confirmed radio changes update cached state immediately. Bridge failure can reconnect on later reads without replaying mutations. Restricted/non-Windows environments provide limited/unavailable values rather than fabricated specifications. Registry dates/driver formats may differ from Windows UI conventions.

`GET /api/system` returns data to the local browser; inventory is not persisted. Copy system info writes visible specifications to the clipboard only on click. Automatic assistant PC context includes device/OS/architecture, resource/network/battery state and control availability, but excludes Device ID, Product ID, manufacturer/model, CPU name, graphics driver and install date unless the user supplies them. Live Desktop never reads a Windows product key. [Backend contracts](../backend/README.md), [validation](VALIDATION.md).
