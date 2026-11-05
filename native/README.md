# Native Windows runtime

C++20/MSVC builds four x64 artifacts under `native/build/Release/`: launcher, frontend host, Windows bridge and JNI credential DLL. Java retains profile/approval/network policy. [Source prerequisites](../README.md#build-and-develop).

```powershell
.\scripts\build-windows-bridge.ps1
.\scripts\test-windows-bridge.ps1
.\scripts\test-native-host.ps1
```

The build finds CMake in PATH or Visual Studio, requires Windows SDK C++/WinRT and Java JNI headers, statically links MSVC runtime and runs CTest protocol checks. VS Code CMake uses the same `native/` source and ignored `native/build/` output; generated root `build/` files are also ignored. Stop owned services before rebuilding loaded binaries.

## Launcher and host

`start.cmd` invokes `live-desktop-launcher.exe`. Deployment requires all four native artifacts, extracted backend JAR/`lib/` and frontend `dist/client/`. [Root README](../README.md) covers Java selection, environment and lifecycle. CDS is optional; `-Xshare:auto` permits fallback for invalid/incompatible archives. Launch performs no build/training/download.

A current-user workspace mutex deduplicates starts. Suspended children enter a Windows Job Object before execution; supervisor/service failure cleans up owned descendants. Ownership never derives from names, ports or saved PIDs. Initial startup rejects unrelated listeners without terminating them. Restart waits for three clear listener samples 100 ms apart within five seconds after cleanup; TIME_WAIT does not count as listening.

The host serves client assets on loopback 4173 and proxies `/api`/`/health` to loopback 4317. Host/Origin checks, canonical/open-handle path confinement, framing/body limits and header filtering apply. Stable assets/HTML use weak ETags and `no-cache`; hashed assets use immutable caching. API responses are not shared immutable assets. Sixteen blocking workers and a 64-entry queue use socket timeouts and close each browser connection after response; streaming/reuse need separate capacity work.

## Windows bridge

Java creates a random named pipe and supplies its PID. Current-user ACLs, remote-client rejection and connected-PID verification constrain access; a watcher exits when the backend dies. Broken peers reset without replaying mutations.

Protocol v1: newline-delimited UTF-8 JSON with `requestId`, allowlisted `operation`, object `arguments`; responses echo version/ID, `ok` and result/error. Limits: 16 KiB requests, 8 MiB responses. Java's serialized 15-second deadline includes queue time; native async work shares 9 seconds and radio confirmation waits up to 1.5 seconds.

| Operations | Capability |
| --- | --- |
| `bridge.health`, `bridge.capabilities` | Protocol status |
| `radio.snapshot`, `radio.set` | Wi-Fi/Bluetooth |
| `power.snapshot`, `system.staticSnapshot` | Power/device/OS/display adapters |
| `system.ioCounters` | Cumulative network octets and physical-disk byte counters |
| `process.knownApps`, `phoneLink.snapshot` | Known process/package observations |
| `media.snapshot`, playback actions, `media.artwork` | Windows sessions/opaque-version raster artwork |
| `windows.openUri`, `browser.openUrl` | Fixed Windows URI allowlist (`ms-settings:*`, `ms-phone:`, `outlookcal:`, `spotify:`) / HTTP(S) launch |

Process snapshots cache for 2 seconds (phone refresh bypasses). Native radio enumeration/Java snapshots each cache for 30 seconds; adapter changes can take roughly 60 seconds. Media notifications update metadata with 30-second revalidation; position reads are independent. Artwork versions include bridge identity, retain four sources up to 4 MiB each and expose no filesystem path.

No arbitrary shell, registry/file path or process-kill operation exists. Hardware switches, Windows permissions and provider/session publication determine availability. [Control capabilities](../docs/WINDOWS_CONTROL_CAPABILITIES.md).

## Credential DLL

JNI wraps current-user `CryptProtectData`/`CryptUnprotectData`, forbids UI and preserves saved formats. Native buffers/temporary byte arrays clear; managed strings/caches retain plaintext while used. The DLL loads only from the installation Release directory, which must stay private. [Validation/limits](../docs/VALIDATION.md).
