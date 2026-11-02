# Live Desktop

A local Windows dashboard for PC telemetry, approved controls, conversations, memories, iCloud Calendar, Phone Link and Apple Music/Spotify. React renders the UI, Java owns state/integrations/approval policy, and C++ provides the runtime and Windows APIs. Profiles stay on this PC; OpenAI, iCloud and music use external services.

## Install and run

Download the Windows x64 ZIP and checksum from [GitHub Releases](https://github.com/TreyU23/Live-Desktop/releases/latest). Extract the entire `Live-Desktop` folder into a writable directory private to your Windows account, run `start.cmd`, then open [localhost:4173](http://localhost:4173).

Requires Windows 10/11 x64 and Java 21. Java-inclusive packages contain `.tools/jdk-21`; otherwise install Java 21 with `JAVA_HOME`, or run `scripts/bootstrap-java.ps1`. Packages need no Node, Maven, Visual Studio, CMake or separate Visual C++ runtime. [Package publishing/registry downloads](docs/PACKAGES.md).

Production binds to `127.0.0.1:4173` and `127.0.0.1:4317`; the frontend host proxies `/api` and `/health`. Use the top-bar restart/shutdown controls or, from the installation directory:

```powershell
.\native\build\Release\live-desktop-launcher.exe status
.\native\build\Release\live-desktop-launcher.exe restart
.\native\build\Release\live-desktop-launcher.exe shutdown
```

Stop before replacing runtime files. Back up `data/` before upgrades; DPAPI credentials are tied to their Windows user. Run `start.cmd` to recover after shutdown.

## Build and develop

Source builds require Java 21, Node.js **20.19+ or 22.12+**, pnpm, Visual Studio 2022 Build Tools with Desktop development with C++, CMake and a Windows SDK containing C++/WinRT. The Maven wrapper is included. In PowerShell at the repository root:

```powershell
.\scripts\bootstrap-java.ps1
pnpm --dir frontend install --frozen-lockfile
.\scripts\build-production.ps1
.\start.cmd
```

Bootstrap verifies and installs Temurin into `.tools/jdk-21`. If scripts are blocked, `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` affects only that terminal. The production build runs native protocol, Java and frontend tests, extracts Java with libraries, trains CDS using isolated data and builds frontend/Sites assets. [Additional validation](docs/VALIDATION.md).

For development, run these in separate terminals:

```powershell
.\scripts\run-backend.ps1
.\scripts\run-frontend.ps1
```

The backend needs the built bridge/DLL. The frontend script binds loopback Vite to strict port 4173. Stop development terminals before production; the supervisor manages only its own children. Rebuild production artifacts after source changes.

## Accounts, profiles and controls

| Feature | Setup and behavior |
| --- | --- |
| Profiles | Header picker creates, renames, switches and deletes local profiles. Browser preferences are profile scoped; backend records use `data/profiles/<id>/`, with the original default profile directly in `data/`. Profiles organize data; they are not an authentication boundary. |
| OpenAI | Save a project API key in Settings. Current-user DPAPI protects stored keys; endpoints return status, not plaintext. Only the default profile uses an environment fallback. API billing is separate from ChatGPT. |
| iCloud Calendar | Enter your Apple email and an **app-specific password** generated at [Apple Account](https://account.apple.com/) with two-factor authentication. Credentials stay DPAPI protected. The read-only agenda supports date selection/refresh and expands in Overview. |
| Music | Choose Apple Music/Spotify and a supported content link in Settings. Visit Music to mount its player; it persists across navigation. Switching preserves separate links. Windows sessions supply metadata/controls. Accounts, subscriptions and browser restrictions apply; no developer credentials are required. |
| Phone Link | Install/pair Microsoft Phone Link. Available local metadata drives details/platform artwork; messages, notification contents and battery availability are not promised. Opening Phone Link is explicitly external. |
| Controls | Wi-Fi/Bluetooth support direct changes where Windows permits. Focus, Night light, Mic privacy and Battery saver open approved Settings pages; opening one confirms no toggle state. [Capabilities](docs/WINDOWS_CONTROL_CAPABILITIES.md). |

Assistant reads run immediately; file writes, durable memories, browser launches and device controls require first-use approval in the matching profile. Inspect the target/scope: matching approved capabilities may run immediately afterward. Workspace reads cap at 100 KB, listings at 500 entries. Canonical checks reject symlink/junction escapes; read/list tools exclude profile data and root `.env` variants except `.env.example`. Keep the installation private: checks do not lock the filesystem against concurrent replacement.

## Configuration

Settings is the normal credential entry point. Optionally copy `.env.example` to root `.env`; keep it private and outside Git. Environment values take precedence.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST`, `PORT` | `127.0.0.1`, `4317` | Backend bind; production fixes both |
| `OPENAI_API_KEY` | empty | Default-profile fallback |
| `OPENAI_MODEL` | `gpt-5.6-sol` | Configured API model identifier |
| `OPENAI_REASONING_EFFORT` | `medium` | SDK reasoning option |
| `DATA_DIR` | `../data` | Production resolves relative paths against `backend/` |
| `WORKSPACE_ROOT` | `..` | Assistant workspace; production fixes installation root |
| `LIVE_DESKTOP_DIAGNOSTICS` | unset | Launch with `1` for bounded backend timing logs |
| `VITE_API_BASE` | same origin | Frontend build/development API override |

The supervisor imports root `.env` and sets internal `LIVE_DESKTOP_ROOT` for data resolution. Java selection: `.tools/jdk-21`, `JAVA_HOME`, PATH. Production runs `backend/target/runtime/live-desktop-backend.jar` with `lib/` and compatible build-time CDS; launch never builds, extracts, trains or downloads.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Occupied port | Stop the known development/other listener. Production leaves unrelated processes alive. |
| Missing/locked artifact | Stop owned services, then rebuild or re-extract the complete package. |
| CDS/JDK mismatch | Extracted Java remains usable; rebuild to train a matching archive. |
| Unknown mutation outcome | Refresh state before retrying. Bridge mutations never automatically replay. |
| Unavailable integration | Check account/device setup. Corrupt keys report unavailable; reconnect iCloud if its password was revoked. |
| Startup failure | Root `.launcher.log`, `.backend-preview.{out,err}.log`, `.frontend-preview.{out,err}.log`; lifecycle requests: `data/runtime-control.log`. |

Readiness checks native `/_live/ready`, direct/proxied `/health` and dashboard `/` for up to 60 seconds; integrations may finish later. `.startup-metrics.jsonl` records cumulative stages/reuse: do not add stages or compare reused starts with fresh launches. A current-user mutex deduplicates starts; Job Object cleanup handles owned descendants on shutdown, supervisor exit or service failure.

## Documentation

- [Backend](backend/README.md), [frontend](frontend/README.md), [native runtime](native/README.md): implementation contracts.
- [Validation/performance](docs/VALIDATION.md): checks, diagnostics and evidence limits.
- [System information](docs/SYSTEM_INFORMATION.md), [Windows controls](docs/WINDOWS_CONTROL_CAPABILITIES.md): sources and capability boundaries.
- [Product](PRODUCT.md), [design system](DESIGN.md), [selected reference](docs/redesign/README.md).

Update affected READMEs whenever setup/behavior changes. Synthetic tests do not establish authenticated accounts, hardware changes, real audio, sleep/resume or independent-user isolation. Shipping to `main` requires project security review and a separate release decision.
