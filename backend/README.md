# Live Desktop backend

The backend is a Java 21/Spring Boot 4.1 service that runs on `127.0.0.1:4317`. It owns profile-isolated OpenAI credentials, conversations, memories, reusable approvals, iCloud CalDAV accounts, relevance-filtered dashboard context, read-only Windows device inspection, allowlisted one-time-approval-backed Wi-Fi and Bluetooth radio changes, Windows and Phone Link inspection, project lifecycle controls, and free local Windows media-session controls with Apple Music or Spotify session preference.

Wi-Fi and Bluetooth use the supported Windows radio API through `scripts/windows-system-control.ps1`; Windows may still reject a request because of permission, hardware, or policy. The backend warms one long-running, private PowerShell radio worker and sends it only allowlisted JSON radio operations, avoiding process and WinRT initialization on each press. A failed worker is discarded and the request uses the existing one-shot fallback. Each control needs approval on its first use for a profile, then later presses execute immediately. The returned state updates the dashboard immediately; stable Windows device and battery data are warmed during startup, expensive Windows radio snapshots are cached for 30 seconds, and battery information is cached for five minutes. Focus, Night light, microphone privacy, and Battery saver remain explicit Windows Settings shortcuts because this app does not use undocumented registry edits or UI automation to change them; their exact settings URI is also remembered after its first approval. Workspace writes are remembered by normalized path, browser launches by exact URL, and assistant memories by category, so new targets still require approval.

`GET /api/system` includes the cached device and Windows specifications used by the System Info tab alongside the existing live resource and control state. See the root [system information access inventory](../docs/SYSTEM_INFORMATION.md) for every field, its Windows or Java source, refresh behavior, and privacy boundary.

Use the complete setup, integration, security, API, test, and troubleshooting instructions in the [project README](../README.md).

For normal use, start the complete project from the repository root with one command:

```powershell
.\start.cmd
```

For backend-only development:

```powershell
.\scripts\bootstrap-java.ps1
.\scripts\run-backend.ps1
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:4317/health
```

Backend state is stored under `data\`. The original profile keeps backward-compatible files directly under `data\`; additional profiles use `data\profiles\<profile-id>\`. Reusable approvals are derived from each profile's approved action history in `assistant-state.json`, so they remain isolated with that profile. iCloud passwords and profile OpenAI API keys are encrypted with Windows DPAPI for the current Windows user before they are written. Decrypted credentials are cached only in profile-isolated backend memory after first use and are cleared when replaced, removed, deleted with a profile, or when the backend restarts. The `X-Profile-Id` request header selects the profile, and a missing header selects `default`. Never commit `.env` or the contents of `data\`.
