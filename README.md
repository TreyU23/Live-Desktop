# Live Desktop

Live Desktop is a local Windows dashboard with system information, approved device controls, conversations, memories, iCloud Calendar, Phone Link status, and an Apple Music/Spotify player. React presents the interface; Java 21/Spring Boot owns profiles, durable state, integrations, OpenAI requests, and approval policy. C++ owns the production supervisor, frontend host, Windows bridge, and credential protection DLL.

Open [http://localhost:4173](http://localhost:4173). Production binds the frontend to `127.0.0.1:4173` and the backend to `127.0.0.1:4317`; `/api` and `/health` pass through the native host. Saved profiles live on this PC. Requests to OpenAI, iCloud, and music providers use their external services.

## Run an installed package

Download `Live-Desktop-windows-x64.zip` from the [latest GitHub release](https://github.com/TreyU23/Live-Desktop/releases/latest). Release assets include a SHA-256 checksum. The complete Windows runtime is also published to the repository's GitHub Packages Maven registry as `com.localassistant:live-desktop-windows-x64:<release-version>:zip`; it contains the same ZIP bytes as the release asset. See [package publishing and downloads](docs/PACKAGES.md) for authenticated registry access.

Extract the entire `Live-Desktop` folder from the Windows x64 ZIP into a writable directory private to your Windows account. Run `start.cmd`, then open the dashboard. If the ZIP does not contain `.tools/jdk-21`, install Java 21 and set `JAVA_HOME`, or run `scripts/bootstrap-java.ps1`.

Normal use requires Windows 10/11 x64 and Java 21. Node, pnpm, Maven, Visual Studio, CMake, and a separate Visual C++ runtime installation are unnecessary. Build tools are only needed for a source checkout. The ZIP contains no saved profiles, credentials, `.env`, logs, or dependency caches.

Use the top-bar restart button, or the power button and its confirmation, to manage an owned production instance. From the installation directory:

```powershell
.\native\build\Release\live-desktop-launcher.exe status
.\native\build\Release\live-desktop-launcher.exe restart
.\native\build\Release\live-desktop-launcher.exe shutdown
```

Stop the application before replacing or rebuilding runtime files. Back up `data/` before upgrades; DPAPI credentials are tied to the Windows user that protected them.

## Build from source

Install Java 21, Node.js 20 or later, pnpm, and Visual Studio 2022 Build Tools with Desktop development with C++, a Windows SDK with C++/WinRT, and CMake. The Maven wrapper is included. Run these commands from the repository root in PowerShell:

```powershell
.\scripts\bootstrap-java.ps1
pnpm --dir frontend install --frozen-lockfile
.\scripts\build-production.ps1
.\scripts\test-windows-bridge.ps1
.\start.cmd
```

If PowerShell blocks local scripts, `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` affects only that terminal. The Java bootstrap verifies a Temurin download and installs `.tools/jdk-21`.

The production build compiles/tests C++, packages/tests Java, extracts the backend deployment, trains CDS with isolated non-secret data, and tests/builds the frontend. It does not run the browser, native-host, or lifecycle suites; run those separately below.

Production uses one layout: `backend/target/runtime/live-desktop-backend.jar` plus its `lib/` directory. The supervisor launches Java directly from the extracted deployment directory and starts `live-desktop-host.exe`. A compatible build-time CDS archive accelerates class loading. No extraction, compilation, training, or download happens during launch. Java selection is `.tools/jdk-21`, then `JAVA_HOME`, then PATH. An absent archive or changed JDK identity uses the extracted JVM runtime with a diagnostic; rebuilding generates a matching archive.

For a runtime ZIP:

```powershell
.\scripts\package-production.ps1 -SkipBuild -IncludeJavaRuntime
.\scripts\test-production-startup.ps1 -PackagePath .\dist\Live-Desktop-windows-x64.zip
```

`dist/Live-Desktop-windows-x64.zip` contains the four native binaries, complete extracted Java deployment, client assets, documentation, `.env.example`, and a SHA-256 `manifest.json`. Omit `-IncludeJavaRuntime` when recipients already have Java 21. Source build commands require a full checkout.

## Development

In separate terminals at the repository root:

```powershell
.\scripts\run-backend.ps1
.\scripts\run-frontend.ps1
```

The development frontend uses loopback Vite on port 4173 and proxies the backend on 4317. Stop those terminals explicitly before starting production; the supervisor manages only processes it owns. Dashboard lifecycle commands require an owning production supervisor.

See the [backend README](backend/README.md), [frontend README](frontend/README.md), and [native README](native/README.md) for their development and implementation contracts.

## Profiles and accounts

The profile picker creates, renames, switches, and deletes local profiles. Appearance, avatar, music links, and profile selection use profile-scoped browser storage. Backend conversations, memories, approvals, and credentials use `data/profiles/<id>/`; the original `default` profile retains files directly under `data/`. Browser profiles are local organization, not separate Windows accounts or an authentication boundary.

Save each profile's OpenAI project key in **Settings → OpenAI API key**. Windows current-user DPAPI protects it at rest; key settings endpoints return availability rather than the key. Corrupt or undecryptable saved keys report unavailable; the default profile may still use its configured environment fallback. Additional profiles do not inherit an environment key. OpenAI API billing/credits are separate from ChatGPT subscriptions. Assistant requests include recent conversation turns and only relevant dashboard context. Memory and workspace reads run immediately; writes, durable memories, browser launches, and device controls require the matching profile's first-use approval. Review the action before approving it. Matching approved capabilities may execute immediately afterward.

Workspace file operations check the configured root and existing canonical ancestors, rejecting symbolic links and Windows junctions that resolve outside it. Text reads are limited to 100 KB and file listings to 500 entries. Read/list tools exclude the configured data directory, the workspace's conventional `data/` subtree and root `.env`/`.env.*` files, including canonical aliases; `.env.example` remains readable as a setup template. Approved writes retain their approval and path checks. Protect the installation from untrusted concurrent filesystem changes; path checks do not lock the directory tree against replacement.

For iCloud Calendar, generate an Apple **app-specific password** at [Apple Account](https://account.apple.com/) with two-factor authentication enabled. Enter the account email and that password in **Settings → iCloud Calendar**. A regular Apple Account password is unsuitable. Credentials stay DPAPI-protected locally; CalDAV traffic is restricted to Apple-owned HTTPS endpoints. Discovery and date results are cached separately, and the widget supports date selection and manual refresh. Reconnect with a new app-specific password if Apple revokes it.

For music, choose Apple Music or Spotify in Settings and paste a supported content link. Open Music once to load its web embed. Once mounted, the embed stays mounted while navigating to other views so playback continues. Provider switching replaces the selected embed and preserves each provider's link. Windows media sessions supply real metadata and controls; start a track once in a player that publishes a Windows session. Developer credentials, MusicKit keys, Spotify OAuth applications, and additional paid APIs are unnecessary. Provider accounts/subscriptions and browser playback restrictions still apply.

Install and pair Microsoft Phone Link for phone status. The backend reads local package/process information and available device/companion metadata; it does not promise access to messages or notification contents. Unknown platform or battery information remains unavailable. The widget labels opening Phone Link as an external action.

Wi-Fi and Bluetooth support verified direct controls where Windows permits them. Focus, Night light, microphone privacy, and Battery saver open the corresponding Windows Settings page after approval; opening Settings does not confirm a toggle changed. See the [control capability inventory](docs/WINDOWS_CONTROL_CAPABILITIES.md) and [system information inventory](docs/SYSTEM_INFORMATION.md).

## Configuration

Settings is the normal path for credentials. Optionally copy `.env.example` to `.env` in the root for the default profile's OpenAI fallback and backend configuration. Keep this file private and outside Git.

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Backend bind; production supervisor fixes loopback |
| `PORT` | `4317` | Backend port; production supervisor fixes 4317 |
| `OPENAI_API_KEY` | empty | Default profile fallback only |
| `OPENAI_MODEL` | `gpt-5.6-sol` | Configured API model identifier |
| `OPENAI_REASONING_EFFORT` | `medium` | SDK reasoning option |
| `DATA_DIR` | `../data` | Relative paths resolve against `backend/` in production |
| `WORKSPACE_ROOT` | `..` | Assistant workspace; supervisor fixes installation root |
| `LIVE_DESKTOP_ROOT` | supervisor-set | Internal installation root used for backend-relative data resolution with the extracted Java working directory; not user configuration |
| `LIVE_DESKTOP_DIAGNOSTICS` | unset | Set `1` in the launching environment for bounded timing logs |

Environment values take precedence over `.env`. The supervisor imports the root `.env` explicitly and resolves relative `DATA_DIR` values against `backend/`, preserving existing data locations. Frontend development/build also supports `VITE_API_BASE`; the normal local build uses same-origin proxy routes.

## Performance and validation

Dashboard resources commit independently. Completion-based polling deduplicates each read, pauses while hidden, and refreshes once on return. Last-known data survives refresh errors with a visible status. Media artwork uses bounded caches and opaque image references; unchanged artwork does not travel in every playback response. See the [performance action plan](docs/PERFORMANCE_ACTION_PLAN.md), [assessment](docs/PERFORMANCE_MIGRATION_ASSESSMENT.md), and [results and remaining validation](docs/PERFORMANCE_RESULTS.md).

With production stopped and ports 4173/4317 free:

```powershell
.\scripts\test-native-host.ps1
.\scripts\test-windows-bridge.ps1
.\scripts\test-production-startup.ps1
npm --prefix frontend test
npm --prefix frontend run test:sites
```

For browser scheduling/rendering checks, run a frontend development server on loopback port 4174, then `npm --prefix frontend run test:browser`. Tests mock integrations and use an installed Microsoft Edge. Backend performance sampling and startup comparisons are documented in the backend README. Optional diagnostics at `?diagnostics=1` expose at most 1,000 non-content request/commit timing samples through `window.liveDesktopTimings()`.

Builds and synthetic tests do not establish live hardware changes, authenticated calendar behavior, continuous real audio, sleep/resume, or independent-user pipe isolation. Keep those checks distinct from HTTP readiness and simulated tests. Publishing or shipping to `main` requires the project security review and a separate release decision.

## Troubleshooting and ownership

The supervisor uses a current-user workspace mutex and Windows Job Object. Repeated starts reuse the owned instance. Shutdown, restart, supervisor exit, or unexpected service exit cleans up only its children and descendants. An occupied port fails startup and leaves unrelated listeners alive; stop the known development process explicitly.

Startup readiness checks native `/_live/ready`, direct backend `/health`, proxied `/health`, and dashboard `/` for up to 60 seconds. `start.cmd` returns after the launcher's readiness checks complete; external integrations and browser widgets can finish later. HTTP availability does not mean every integration is ready.

Logs in the root: `.launcher.log`, `.backend-preview.out.log`, `.backend-preview.err.log`, `.frontend-preview.out.log`, and `.frontend-preview.err.log`. `.startup-metrics.jsonl` records cumulative supervisor stages and command launch-to-ready timings, including whether a start reused an instance. Do not add cumulative stages or compare reused starts with fresh processes. Lifecycle requests also log under `data/runtime-control.log`.

Missing artifacts identify the failing path: rebuild from source or re-extract the full package. A native DLL/executable locked during build usually means the owned application is still running. CDS/JDK mismatch diagnostics call for rebuilding the deployment; the extracted JVM path remains available. Bridge failures do not replay mutations: refresh state before retrying a change whose result is unknown. Read [startup verification details](docs/STARTUP_VALIDATION.md) and [native migration limitations](docs/WINDOWS_NATIVE_MIGRATION.md) for historical evidence.
