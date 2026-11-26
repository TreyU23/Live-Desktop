# Live Desktop

Current release: **3.1.0** — see the [release notes](docs/RELEASE_3.1.0.md). There is no public 2.x: version 2 was the Apple-style glass design, which was never released.

A local Windows dashboard for PC telemetry, approved controls, conversations, memories, iCloud Calendar, Phone Link and Apple Music/Spotify. React renders the UI, Java owns state/integrations/approval policy, and C++ provides the runtime and Windows APIs. Profiles stay on this PC; the assistant model provider (OpenAI or Anthropic), iCloud and music use external services.

## Install and run

Download the Windows x64 ZIP and checksum from [GitHub Releases](https://github.com/TreyU23/Live-Desktop/releases/latest). Extract the entire `Live-Desktop` folder into a writable directory private to your Windows account, run `start.cmd`, then open [localhost:4173](http://localhost:4173).

Requires Windows 10/11 x64 and Java 21. Java-inclusive packages contain `.tools/jdk-21`; otherwise install Java 21 with `JAVA_HOME`, or run `scripts/bootstrap-java.ps1`. Packages need no Node, Maven, Visual Studio, CMake or separate Visual C++ runtime. [Package publishing/registry downloads](docs/PACKAGES.md).

Production binds to `127.0.0.1:4173` and `127.0.0.1:4317`; the frontend host proxies `/api` and `/health`. Each backend launch issues a local access token on loopback `GET /health` as `X-Live-Desktop-Token`; in production the launcher also creates a per-launch bridge secret (`LIVE_DESKTOP_BRIDGE_SECRET`) that only the native host adds to its `/health` proxy call, and without it the backend withholds the token. Direct calls to port 4317 from any web page therefore cannot obtain it. Development (no secret) keeps the loopback-only behavior. Development Vite listens on `127.0.0.1:4173` unless `VITE_HOST` is set; the dev proxy then withholds the token from non-loopback callers. Every other route requires that header. `Host` must be `127.0.0.1` or `localhost` on the backend port. A sent `Origin` must be `http://127.0.0.1:4173`, `http://localhost:4173`, or the same hosts on the backend port. `POST` and `DELETE` require `Content-Type: application/json`. Use the top-bar restart/shutdown controls or, from the installation directory:

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
| Profiles | Header picker creates, renames, switches and deletes local profiles. Browser preferences are profile scoped; backend records use `data/profiles/<id>/`, with the original default profile directly in `data/`. A profile photo is cropped to a 256 px square and stored as a small WebP (or JPEG) in browser storage; images over 20 MB or that can't be decoded are refused with a message, and a profile change that can't be saved (browser storage full) shows an error instead of appearing to work. Profiles organize data; they are not an authentication boundary. |
| Assistant model | Settings → Assistant → **Model** picks the provider per profile: OpenAI (GPT-6.2 Sol, the default) or Anthropic (Claude Sonnet 5.5). Each provider needs its own API key, saved in Settings: an OpenAI project key (`sk-…`) or an Anthropic Console key (`sk-ant-…`). Current-user DPAPI protects stored keys; endpoints return status, not plaintext. Only the default profile uses environment fallbacks. API billing is separate from ChatGPT and Claude subscriptions. Switching providers keeps conversation history; the next message goes to the newly chosen model. |
| iCloud Calendar | Enter your Apple email and an **app-specific password** generated at [Apple Account](https://account.apple.com/) with two-factor authentication. Credentials stay DPAPI protected. The read-only agenda supports date selection/refresh and expands in Overview. |
| Music | Choose Apple Music/Spotify and a supported content link in Settings. Visit Music to mount its player; it persists across navigation. Switching preserves separate links. Windows sessions supply metadata/controls. Accounts, subscriptions and browser restrictions apply; no developer credentials are required. |
| Phone Link | Install/pair Microsoft Phone Link. Available local metadata drives details/platform artwork; messages, notification contents and battery availability are not promised. Opening Phone Link is explicitly external. |
| Controls | Wi-Fi/Bluetooth support direct changes where Windows permits. Focus, Night light, Mic privacy and Battery saver open approved Settings pages; opening one confirms no toggle state. [Capabilities](docs/WINDOWS_CONTROL_CAPABILITIES.md). |

Assistant reads run immediately; file writes, durable memories, browser launches and device controls require first-use approval in the matching profile. Inspect the target/scope: matching approved capabilities may run immediately afterward. A durable memory is matched on its category and exact text. A file write is matched on its path and exact content, so changed content asks again, and a failed action never counts as an approval. Assistant writes cannot touch Live Desktop's own folders (`data`, `native`, `backend`, `frontend`, `scripts`, `.tools`, `.git`, `.github`, `.mvn`), any file at the workspace root, any dot-file or dot-folder (`.vscode`, `.idea`, `.env`, `.env.*`, ...), build, editor and coding-agent files by name anywhere (`pom.xml`, `mvnw`, `package.json`, Gradle files, `Makefile`, `AGENTS.md`, `CLAUDE.md`, ...), and only plain-text types are writable (`.txt`, `.md`, `.markdown`, `.json`, `.csv`, `.tsv`, `.yaml`, `.yml`, `.toml`, `.ics`, `.log`); everything else, including extensionless files and types Windows runs or acts on such as `.js`, `.url`, `.scf` and `.cmd`, is refused. Workspace reads cap at 100 KB, listings at 500 entries. Canonical checks reject symlink/junction escapes; read/list tools exclude profile data and root `.env` variants except `.env.example`. Keep the installation private: checks do not lock the filesystem against concurrent replacement.

## Configuration

Settings is the normal credential entry point. Optionally copy `.env.example` to root `.env`; keep it private and outside Git. Environment values take precedence.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST`, `PORT` | `127.0.0.1`, `4317` | Backend bind; production fixes both on the backend command line, so `.env` cannot change them |
| `ASSISTANT_PROVIDER` | `openai` | Provider for profiles that haven't picked one in Settings: `openai` or `anthropic` (anything else means `openai`) |
| `OPENAI_API_KEY` | empty | Default-profile fallback for the OpenAI key |
| `OPENAI_MODEL` | `gpt-6.2-sol` | OpenAI model identifier |
| `OPENAI_REASONING_EFFORT` | `medium` | OpenAI reasoning effort |
| `ANTHROPIC_API_KEY` | empty | Default-profile fallback for the Anthropic key |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Anthropic model identifier |
| `ANTHROPIC_EFFORT` | `medium` | Claude effort (`low`, `medium`, `high`, `xhigh`, `max`); Claude Sonnet 5.5 always uses adaptive thinking |
| `DATA_DIR` | `../data` | Production resolves relative paths against `backend/` |
| `WORKSPACE_ROOT` | `..` | Assistant workspace; production fixes installation root on the command line, so `.env` cannot widen it |
| `LIVE_DESKTOP_DIAGNOSTICS` | unset | Launch with `1` for bounded backend timing logs |
| `VITE_API_BASE` | same origin | Frontend build/development API override |

The backend imports only the install-root `.env` (`${LIVE_DESKTOP_ROOT}/.env`); a `.env` anywhere else, such as `backend/target/.env`, is never loaded. The supervisor sets internal `LIVE_DESKTOP_ROOT` for data resolution. Java selection: `.tools/jdk-21`, `JAVA_HOME`, PATH. Production runs `backend/target/runtime/live-desktop-backend.jar` with `lib/` and compatible build-time CDS; launch never builds, extracts, trains or downloads.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Occupied port | Stop the known development/other listener. Production leaves unrelated processes alive. |
| Missing/locked artifact | Stop owned services, then rebuild or re-extract the complete package. |
| CDS/JDK mismatch | Extracted Java remains usable; rebuild to train a matching archive. |
| Unknown mutation outcome | Refresh state before retrying. Bridge mutations never automatically replay. |
| Unavailable integration | Check account/device setup. Corrupt keys report unavailable; reconnect iCloud if its password was revoked. |
| Startup failure | Root `.launcher.log`, `.backend-preview.{out,err}.log`, `.frontend-preview.{out,err}.log`; lifecycle requests: `data/runtime-control.log`. |
| `403` Local access only | Read `X-Live-Desktop-Token` from `GET /health` and send it on the next call. `POST` and `DELETE` also need `Content-Type: application/json`. Call `127.0.0.1` or `localhost` on the backend port. |

Readiness checks native `/_live/ready`, direct/proxied `/health` and dashboard `/` for up to 60 seconds; integrations may finish later. `.startup-metrics.jsonl` records cumulative stages/reuse: do not add stages or compare reused starts with fresh launches. A current-user mutex deduplicates starts; Job Object cleanup handles owned descendants on shutdown, supervisor exit or service failure.

## Documentation

- [Project map](docs/PROJECT-MAP.html): plain-language map of the three parts, all seven views, the approval rule and the folder layout. Open it in a browser.
- [Project working guide](docs/PROJECT-WORKING-GUIDE.md): development, design, security, validation, and release procedures for contributors and agents.
- [Backend](backend/README.md), [frontend](frontend/README.md), [native runtime](native/README.md): implementation contracts.
- [Validation/performance](docs/VALIDATION.md): checks, diagnostics and evidence limits.
- [System information](docs/SYSTEM_INFORMATION.md), [Windows controls](docs/WINDOWS_CONTROL_CAPABILITIES.md): sources and capability boundaries.
- [Release notes 3.1.0](docs/RELEASE_3.1.0.md), [3.0.4](docs/RELEASE_3.0.4.md), [3.0.3](docs/RELEASE_3.0.3.md), [3.0.2](docs/RELEASE_3.0.2.md), [3.0.1](docs/RELEASE_3.0.1.md), [3.0.0](docs/RELEASE_3.0.0.md), [1.1.0](docs/RELEASE_1.1.0.md), [1.0.0](docs/RELEASE_1.0.0.md).
- [Product](PRODUCT.md), [design system](DESIGN.md), [selected reference](docs/redesign/README.md).

Update affected READMEs whenever setup/behavior changes. Synthetic tests do not establish authenticated accounts, hardware changes, real audio, sleep/resume or independent-user isolation. Shipping to `main` requires project security review and a separate release decision.
