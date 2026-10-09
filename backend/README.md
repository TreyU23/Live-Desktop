# Live Desktop backend

Java 21/Spring Boot runs on `127.0.0.1:4317` and owns profiles, persistence, OpenAI, iCloud CalDAV, dashboard context, and approval policy. Native Windows integration is required; there is no PowerShell integration provider or fallback.

One shared C++ bridge handles radios, media sessions, battery status, device/Windows specifications, known-app and Phone Link package/process detection, and allowlisted Windows/browser launching. Java starts it lazily, using a random user-restricted named pipe with owning-backend PID verification. Failures return unavailable; a later request can reconnect, but failed requests are not replayed. Refresh actual state before retrying an ambiguous mutation. Radio snapshots are cached for 30 seconds and battery data for five minutes. Static specifications are warmed and cached during startup.

Credential protection uses `live-desktop-credentials.dll` through JNI, with current-user DPAPI and unchanged saved-record formats. Secrets do not pass through the bridge. Existing profile-isolated decrypted-credential caches remain; replacing/removing credentials, deleting their profile, or restarting clears the applicable cache. Additional profiles use `data/profiles/<profile-id>`; the default retains records directly under `data`. Never commit `.env` or `data`.

Approval behavior is unchanged: the first matching control/URI/URL/path/category action requires approval for its profile. Unsupported consumer toggles remain approved Settings shortcuts, not undocumented registry edits. Phone Link device metadata is still parsed locally by Java; package/process detection is native. Startup/restart/shutdown remain PowerShell until the separate lifecycle/startup migration.

Night light, Battery saver, Focus, and microphone privacy shortcuts already use C++ `windows.openUri`/`ShellExecuteExW`; their results mean a Settings URI opened, not that Windows changed a toggle. See the [remaining-control API audit and regression coverage](../docs/WINDOWS_CONTROL_CAPABILITIES.md). A different microphone mute or power-plan operation is not substituted for the current feature.

See the [root setup and API instructions](../README.md), [native protocol/security/build details](../native/README.md), [information inventory](../docs/SYSTEM_INFORMATION.md), and [current migration validation](../docs/WINDOWS_NATIVE_MIGRATION.md).

From the repository root, after installing Visual Studio 2022 C++ Build Tools and a Windows SDK:

```powershell
.\scripts\bootstrap-java.ps1
.\scripts\build-windows-bridge.ps1
.\scripts\test-windows-bridge.ps1
.\start.cmd
```

For backend-only development use `scripts/run-backend.ps1`. It checks that both native artifacts exist before launching Maven. Nothing is compiled/downloaded by that check. Rebuild after native changes; stop the backend first if Windows locks the DLL. Restart after rebuilding. Java and native artifacts must be x64.

```powershell
$env:JAVA_HOME = (Resolve-Path '.tools\jdk-21').Path
.\mvnw.cmd test
Invoke-RestMethod http://127.0.0.1:4317/health
```

Build native before tests: the live pipe test skips if its executable is absent, while Windows credential tests require the DLL. Live read-only tests do not establish hardware toggle, media mutation, sleep/resume, or cross-user security behavior.
