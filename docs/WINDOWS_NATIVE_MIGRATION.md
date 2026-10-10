# Windows-native integration migration

Implementation status: the Windows integration section is native-only. Production lifecycle, native frontend hosting/proxy, readiness instrumentation, and runtime packaging are implemented; further JVM startup work remains pending.

## Completed scope

- Shared C++/WinRT radio and media-session worker; existing API contracts and Java profile/approval policy retained.
- Native battery, CPU/topology, memory, graphics, Windows/device registry inspection, known-app process filtering, and Phone Link package/process detection.
- Allowlisted Windows/Phone Link and HTTP(S) launching through `ShellExecuteExW`, replacing helper-process launches.
- In-process JNI current-user DPAPI credential protection. Existing protected-record format is retained; secrets do not cross the named pipe.
- Mandatory native EXE/DLL launch preflight, updated setup/security documentation, and removal of superseded radio/media PowerShell scripts. Removed scripts remain recoverable through Git history.

Java retains OpenAI/CalDAV networking, recurrence handling, persistence, profiles, approvals, dashboard shaping, live CPU/memory/network/storage APIs, and parsing Phone Link's app-owned metadata files. Rewriting those without profiling evidence would not establish a speed improvement. Phone Link metadata remains best-effort local cache inspection, not a public device-management API.

## Verification

On October 8, 2026, Release EXE and JNI DLL build passed with Visual Studio Build Tools 2022 17.14.41, MSVC 19.44, Windows SDK 10.0.26100.0, and CMake 3.31.6. CTest protocol self-test passed (1/1). The final full backend rerun passed 31 tests without failures/errors/skips, including forced termination of the test-owned bridge followed by a successful new read.

Read-only smoke coverage includes all native inspection capabilities, media snapshots for music/Apple/Spotify, invalid operation/version/provider rejection, and denied non-allowlisted URI schemes. Java tests exercise live pipe calls and clean relaunch. Credential tests exercise Unicode encryption/decryption, corrupt-record rejection, new-store credential reloads, and a synthetic .NET/PowerShell DPAPI fixture decrypted by JNI. They do not rewrite real saved credentials.

After restarting with `start.cmd`, backend health returned `ok` and the frontend returned HTTP 200. Live `/api/system`, `/api/system/apps`, `/api/integrations/phone-link`, and Apple/Spotify media-session reads all returned HTTP 200. Native specifications returned the actual machine's manufacturer, processor, and core counts, and one bridge process was observed owned by the backend. This is API-level verification, not visual browser QA or playback validation. Media reads covered unavailable-session responses, not active artwork/playback.

One warm read-only smoke run measured 1.86 ms mean for nine subsequent radio snapshots; launch through all integration checks was 707.20 ms. A single warm HTTP sample measured system 183.43 ms, apps 11.78 ms, Phone Link 19.03 ms, and media 3.92–4.09 ms, including PowerShell HTTP-client overhead. These are observations without a matched baseline, not improvement percentages or percentile estimates. Diff whitespace checks passed.

Actual Wi-Fi/Bluetooth on/off, permission denial, media commands/system mute, accepted app/URL launching, sleep/resume, adapter removal, and separate-user pipe isolation remain live validation tasks. Test success is not proof of these behaviors. Read-only validation deliberately does not disrupt connectivity, audio, or launch external applications.

## Performance boundary and next section

No normal integration request now launches PowerShell. The media manager and radio handles are retained; DPAPI runs in-process. This removes the interpreter/helper-process startup path but does not establish an end-to-end dashboard speedup or a cold-start SLA.

[Historical radio-only measurements](PHASE_1_RADIO_VALIDATION.md) are a limited warm-cache development benchmark, not measurements for the expanded bridge or full application startup. The expanded smoke test's launch-through-integration-checks time includes several different operations and cannot be compared directly with that historical first-radio result.

Production lifecycle now uses `native/launcher/main.cpp`; `RuntimeService` signals that supervisor directly. The old port-based PowerShell lifecycle script is removed. Production starts a packaged Java JAR and the native built-frontend HTTP host; Maven and Vite remain build/development tools. Setup/build/development PowerShell scripts remain. See [launcher operation and ownership](../native/README.md) and [startup validation](STARTUP_VALIDATION.md). AppCDS/GraalVM and further JVM startup work remain unimplemented; there is no measured before/after speedup claim.

See [native operations, security bounds, and setup](../native/README.md). Credential APIs follow Windows [DPAPI](https://learn.microsoft.com/en-us/windows/win32/SecCrypto/example-c-program-using-cryptprotectdata); JNI preserves current-user scope and no optional entropy to match previous records.
