# Native Windows runtime

C++ provides four Windows x64 artifacts: the production launcher, frontend host, owning-backend Windows bridge, and JNI credential DLL. Java retains HTTP/profile/state/approval/network policy; React retains presentation. See the [root README](../README.md) for installation and source prerequisites.

## Build and test

Install Visual Studio 2022 Build Tools with Desktop development with C++, a Windows SDK containing C++/WinRT, CMake, and Java 21 JNI headers. From the repository root:

```powershell
.\scripts\build-windows-bridge.ps1
.\scripts\test-windows-bridge.ps1
.\scripts\test-native-host.ps1
```

The build locates CMake in PATH or Visual Studio, uses MSVC/C++20, runs CTest protocol checks, and emits the four artifacts under `native/build/Release/`. The MSVC runtime is linked statically. Stop the owned application before rebuilding loaded binaries. `scripts/build-production.ps1` also refreshes Java/frontend artifacts and trains Java CDS.

## Supervisor and deployment

`start.cmd` starts `live-desktop-launcher.exe`. The launcher requires the four native artifacts, `backend/target/runtime/live-desktop-backend.jar`, its library directory, and `frontend/dist/client/index.html`. It selects Java from the local JDK, `JAVA_HOME`, or PATH, uses the extracted backend working directory with explicit root `.env` import and backend-relative data resolution, and fixes loopback ports 4317/4173 and workspace root. Compatible CDS is selected at launch; a missing archive or changed JDK release identity prints an extracted-runtime diagnostic. JVM archive validation uses `-Xshare:auto`; incompatible/corrupt archives can be ignored with JVM diagnostics. Normal launch never builds, extracts, trains, or downloads.

A current-user workspace mutex prevents duplicates. Suspended children are placed in a Windows Job Object before execution; supervisor termination or unexpected child exit cleans up owned descendants. Start/restart/shutdown never infer ownership from a process name, port, or saved PID. An unrelated listener causes a startup error and survives. Active LISTEN records determine occupancy, avoiding TIME_WAIT false positives.

After owned Job Object cleanup, listener release must remain clear across three samples 100 ms apart within a five-second deadline; restart repeats this check before spawning replacements. Initial launch still rejects occupied ports immediately. The launcher never terminates an unrelated listener while waiting.

Readiness checks native host identity, direct backend health, proxied health, and the frontend root. Metrics are cumulative from supervisor cycle start; command timings include reuse/restart semantics. Logs and `.startup-metrics.jsonl` live beside `start.cmd`. Read [startup validation](../docs/STARTUP_VALIDATION.md) for historical tests and [performance results](../docs/PERFORMANCE_RESULTS.md) for current evidence.

## Frontend host

`live-desktop-host.exe --root WORKSPACE` serves `frontend/dist/client` and proxies `/api` and `/health` to `127.0.0.1:4317`. The listener is loopback-only. Host/Origin checks, canonical path and opened-handle confinement, request framing/body limits, hop-by-hop header filtering, explicit cookie/redirect/authentication behavior, and bounded workers remain enforced.

Stable filenames and HTML use `no-cache` with weak timestamp/size ETags and conditional 304 responses. Content-hashed JavaScript/CSS/font assets use immutable caching. API results are not treated as shared immutable assets. The host uses 16 blocking workers and a 64-entry queue with socket timeouts; it closes browser connections after each response. Connection reuse and long-lived assistant streaming require separate capacity/framing evidence before adoption.

## Windows bridge

Java starts one bridge with a random per-backend pipe name and parent PID. Current-user ACLs, remote-client rejection, and connected-PID verification constrain access. A watcher terminates the bridge when its owning backend exits. Java resets broken peers; failed changes are not automatically replayed.

Protocol v1 uses newline-delimited UTF-8 JSON with `requestId`, typed allowlisted `operation`, and object `arguments`. Responses echo version/ID and `ok`, plus an object result or error. Requests are limited to 16 KiB and responses to 8 MiB. Java transport serializes requests and includes queue wait in a 15-second deadline; native asynchronous operations share a nine-second budget. Radio confirmation waits up to 1.5 seconds. Credentials do not pass through this protocol.

| Operations | Windows capability |
| --- | --- |
| `bridge.health`, `bridge.capabilities` | Protocol availability |
| `radio.snapshot`, `radio.set` | Supported Wi-Fi/Bluetooth reads and writes |
| `power.snapshot`, `system.staticSnapshot` | Power, device, OS, display adapter information |
| `process.knownApps`, `phoneLink.snapshot` | Shared known-process/package observations |
| `media.snapshot`, playback actions | Global System Media Transport Controls |
| `media.artwork` | Cached raster artwork by opaque version |
| `windows.openUri`, `browser.openUrl` | Fixed Windows URI allowlist or HTTP(S) browser launch |

Process/package observations share a two-second cache; Phone Link explicit refresh bypasses it. Radio handles live for 30 seconds, with Java's separate 30-second snapshot cache; adapter changes can take roughly 60 seconds through both. Media metadata uses session change notifications and a 30-second revalidation bound. Playback position is read independently. Artwork bytes are read on metadata changes and retained in four entries, each limited to a 4 MiB raster source. They are encoded only when the image route is requested. Snapshot responses carry opaque backend URLs, not repeated artwork data. Version IDs include bridge lifetime identity; stale versions fail instead of exposing paths. Java verifies raster signatures and returns image bytes through a constrained, privately cached route.

No arbitrary shell, registry path, file path, or process-kill operation is exposed. Java approval policy remains authoritative for consequential device/launch actions. Windows permissions, hardware switches, provider publication, session availability, and sleep/resume still affect results.

## Credential DLL and verification limits

`live-desktop-credentials.dll` calls current-user `CryptProtectData`/`CryptUnprotectData` with UI forbidden and compatible saved formats. Native buffers and temporary plaintext byte arrays are cleared. Managed credential strings and profile caches still hold secrets while in use. The DLL loads only from the installation Release directory; protect that directory from untrusted writes.

Protocol/build/read-only tests do not establish radio mutations, continuous real playback, sleep/resume, or isolation between independent Windows users. Keep hardware/account validation separate from mocks and HTTP readiness. Package lifecycle tests verify owned cleanup and unrelated-listener survival. Security review is required before shipping changes to `main`.
