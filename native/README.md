# Native Windows integration

The required x64 C++20 bridge replaces PowerShell for normal Windows integrations. A separate JNI DLL handles current-user DPAPI in the JVM; credentials never enter IPC.

## Build and verify

Install Java 21 first (`scripts/bootstrap-java.ps1`), Visual Studio 2022 Build Tools with Desktop development with C++, a Windows SDK containing C++/WinRT headers, and CMake tools. To install the C++ workload:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --accept-source-agreements --accept-package-agreements --silent --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
.\scripts\build-windows-bridge.ps1
.\scripts\test-windows-bridge.ps1
```

The build locates bundled CMake through `vswhere`, uses Java JNI headers from `JAVA_HOME` or `.tools/jdk-21`, builds Release, and runs CTest. Outputs are `native/build/Release/live-desktop-windows-bridge.exe` and `live-desktop-credentials.dll`; both are required before launch. There is no provider setting or PowerShell fallback. Stop the backend before rebuilding a DLL that Windows has locked; restart after a rebuild. Startup does not compile or download native artifacts.

The integration smoke test starts/stops only its own bridge, reads radios, power, specifications, app/package state, and each media provider; it checks rejected protocol/operation/URI requests. It does not toggle hardware, control playback, open apps, or touch saved credentials. Its timing through integration checks is not a full application-startup measurement.

## Operation boundary

| Operations | Windows implementation |
| --- | --- |
| `bridge.health`, `bridge.capabilities` | Protocol/operation inspection |
| `radio.snapshot`, `radio.set` | C++/WinRT Radios; only Wi-Fi/Bluetooth |
| `media.snapshot`, `media.play`, `media.pause`, `media.next`, `media.previous`, `media.shuffle`, `media.mute` | Global media sessions; provider allowlist; mute uses paired volume-mute input |
| `power.snapshot` | `GetSystemPowerStatus` |
| `system.staticSnapshot` | Fixed read-only registry keys, CPU topology/power APIs, physical memory, DXGI |
| `process.knownApps`, `phoneLink.snapshot` | Toolhelp fixed-name process filter; Phone Link package-family query |
| `windows.openUri`, `browser.openUrl` | `ShellExecuteExW`; fixed Settings/Phone Link URI list or HTTP(S) |

No arbitrary shell command, filesystem path, registry key, or process-kill operation is exposed. Java retains approval, profile, persistence, networking, and Phone Link local metadata policy.

## Ownership, protocol, and failure behavior

Java starts one shared bridge with a random per-backend pipe and parent PID. The ACL grants only the current user's SID, rejects remote clients, and the server verifies the connected PID is the backend. The parent watcher exits the bridge when the backend exits; Java closes it on shutdown. A broken connection is discarded and a later request can start a new peer. Failed mutations are never automatically replayed.

UTF-8 newline JSON uses `protocolVersion: 1`, bounded `requestId`, `operation`, and object `arguments`. Responses echo version/ID and boolean `ok`, with object `result` or `error` containing code/message. Requests are limited to 16 KiB; responses to 8 MiB, including media artwork limited to 4 MiB. Requests are serialized, async Windows operations share a nine-second budget, and Java applies a 15-second transport/startup timeout. Radio state verification waits at most 1.5 seconds before reporting failure.

Radio handles are retained for 30 seconds and cleared on errors. Java caches successful snapshots for 30 seconds, so adapter arrival/removal can take about 60 seconds through both caches. Media manager reuse avoids per-request WinRT startup. Windows permissions, hardware switches, policies, session publication, and package availability still apply.

The JNI DLL uses `CryptProtectData`/`CryptUnprotectData`, current-user scope, no optional entropy, and UI forbidden. Formats remain compatible with existing protected records. Native buffers and temporary plaintext byte arrays are cleared, but credentials still exist in managed strings and the existing profile caches while in use. It loads only from the workspace native Release directory, not PATH; protect that directory from untrusted writes.

## Validation

See [current migration verification and limitations](../docs/WINDOWS_NATIVE_MIGRATION.md). Historical radio-only timings are preserved separately in [Phase 1 measurements](../docs/PHASE_1_RADIO_VALIDATION.md). Compilation and read-only tests are not proof of actual hardware/media mutations, sleep/resume, or independent-user pipe isolation.
