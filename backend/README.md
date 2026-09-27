# Live Desktop backend

The backend is a Java 21/Spring Boot 4.1 service that runs on `127.0.0.1:4317`. It owns profile-isolated OpenAI credentials, conversations, memories, approvals, iCloud CalDAV accounts, relevance-filtered dashboard context, read-only Windows device inspection, allowlisted approval-backed Wi-Fi and Bluetooth radio changes, Windows and Phone Link inspection, project lifecycle controls, and free local Windows media-session controls with Apple Music or Spotify session preference.

Wi-Fi and Bluetooth use the supported Windows radio API through `scripts/windows-system-control.ps1`; Windows may still reject a request because of permission, hardware, or policy. Focus, Night light, microphone privacy, and Battery saver remain explicit Windows Settings shortcuts because this app does not use undocumented registry edits or UI automation to change them.

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

Backend state is stored under `data\`. The original profile keeps backward-compatible files directly under `data\`; additional profiles use `data\profiles\<profile-id>\`. iCloud passwords and profile OpenAI API keys are encrypted with Windows DPAPI for the current Windows user before they are written. The `X-Profile-Id` request header selects the profile, and a missing header selects `default`. Never commit `.env` or the contents of `data\`.
