# Backend

Java 21/Spring Boot 4.1 owns HTTP APIs, profile context, durable assistant state, approval policy, OpenAI orchestration, iCloud CalDAV, and Phone Link JSON parsing. The backend listens on `127.0.0.1:4317`; normal browser requests reach it through the frontend's `/api` and `/health` proxy. Native Windows operations and DPAPI are required for their respective integrations.

## Build and run

Follow the [root setup](../README.md) for Java and C++ prerequisites. From the repository root:

```powershell
.\scripts\build-production.ps1
.\start.cmd
```

Production runs the extracted `backend/target/runtime/live-desktop-backend.jar` and `lib/` with a compatible Java 21 CDS archive. The supervisor starts Java with the extracted directory as its working directory and fixes `WORKSPACE_ROOT`, `LIVE_DESKTOP_ROOT`, `HOST`, and `PORT`. It imports root `.env` explicitly; relative `DATA_DIR` is resolved against `backend/`, preserving `../data` and existing custom locations. Rebuild all production artifacts after source edits. The ZIP includes the extracted runtime, not Maven or source.

For backend development, `scripts/run-backend.ps1` checks the Windows bridge and credential DLL, selects the project JDK, and runs Maven. Stop the backend before rebuilding a loaded native DLL. For Java tests:

```powershell
$env:JAVA_HOME = (Resolve-Path '.tools\jdk-21').Path
.\mvnw.cmd -pl backend test --no-transfer-progress
```

Native live pipe tests skip when the bridge is absent; Windows credential compatibility tests need the DLL. The production build runs backend tests but not every host/lifecycle/browser suite.

## API and responsibilities

| Routes | Responsibility |
| --- | --- |
| `/health`, `/api/profile/settings` | Availability and non-secret key status |
| `/api/profile/openai-key` | Save/delete a DPAPI-protected profile key |
| `/api/profile/data` | Delete a non-default profile's local backend records |
| `/api/conversations`, `/api/conversations/{id}`, `/api/chat` | Summaries, selected history, assistant replies |
| `/api/memories`, `/api/memories/{id}` | Local memory reads/writes |
| `/api/actions`, `/api/actions/{id}/approve`, `/reject` | Durable proposed actions and approval execution |
| `/api/system`, `/api/system/apps`, `/api/system/controls/{id}` | System information and approved controls |
| `/api/runtime`, `/api/runtime/{action}` | Owned supervisor status/restart/shutdown |
| `/api/integrations/phone-link`, `/open` | Local phone information and approved external launch |
| `/api/integrations/icloud-calendar`, `/connect` | Selected date, refresh, account connection/disconnection |
| `/api/integrations/media-session`, `/{action}`, `/artwork/{version}` | Playback snapshots, controls, bounded raster artwork |

`X-Profile-Id` selects a local profile. The default profile stores records directly in `data/`; others use `data/profiles/<id>/`. Request-scoped context is cleared after each request. Profile deletion waits for existing requests for that profile, preventing concurrent cache/persistence work from racing file removal. Different profiles remain independent. These profiles are not an authentication boundary between Windows users.

State format remains version 1. Memories, actions, conversation summaries, and selected conversations use targeted defensive reads; they do not copy unrelated history. Mutable action JSON is copied at storage boundaries. Atomic file replacement precedes publishing new state in memory. Approval/action persistence remains synchronous; there is no debounce. State writes still serialize the full saved file, which is a separate future measurement question.

## Integrations and cache lifecycle

Java starts one owning-PID-checked, current-user-only C++ bridge lazily. Transport remains serialized, with a 15-second overall budget including queue wait; expired queued reads are not dispatched. A failed dispatched mutation is ambiguous and is never automatically replayed. Later requests can reconnect. See the [native protocol](../native/README.md).

Radio snapshots cache for 30 seconds, battery data for five minutes, and static specifications for the backend lifetime. Phone Link package/process detection uses the native two-second shared snapshot. A manual `refresh` query bypasses that snapshot and local JSON cache. Device/companion JSON is bounded to 1 MiB per file, cached by size/mtime for at most 30 seconds, and rejected if partial or replaced during reading. Battery and notification signals derive from one parsed companion document.

Calendar caches at most 32 profiles and eight dates per profile, each for four minutes; discovery caches for 30 minutes. Reads deduplicate per profile/date, with at most eight pending dates per profile. Network work runs outside the service-wide cache lock, and four fetch slots limit active CalDAV work. Refresh work has an overall 15-second budget, and errors have a 15-second retry cache. Disconnect/reconnect/profile removal invalidate pending results. Errors preserve events only for the same requested date. Passwords use current-user DPAPI. Every request and redirect validates an Apple-owned HTTPS host before sending credentials; arbitrary XML URLs cannot receive authorization. Existing recurrence/all-day/timezone parsing remains in ical4j.

OpenAI clients are cached by profile with a key fingerprint, up to 16 entries. Key replacement/removal, profile removal, eviction, and shutdown retire clients; leases keep active requests usable until completion and then close retired clients. Keys are not map keys. The assistant retains recent turns, bounded tool rounds, selective dashboard context, and approval semantics. Streaming is not enabled.

Artwork routes accept opaque bounded version identifiers, never filesystem paths. Native images are limited to 4 MiB, with four native cache entries; Java verifies PNG/JPEG/GIF/WebP signatures before returning bytes. Browser responses use private short-lived caching and `nosniff`. Playback responses contain image references rather than repeated Base64 content. Media snapshots describe the Windows session, which may depend on the provider/browser publishing it.

## Credentials and configuration

See the [root environment table](../README.md#configuration). Settings is the normal credential entry point; `OPENAI_API_KEY` is only the default-profile fallback. Key availability reflects usable DPAPI-decrypted credentials or that fallback, so corrupt saved records do not falsely report a configured key. Key settings endpoints return status, not plaintext keys. Credentials use the in-process JNI DLL, never pipe IPC. Protect the installation directory and `data/` from untrusted writes. Decrypted credentials exist in memory while used and are cleared from applicable caches on replacement/removal/restart.

Workspace operations enforce the normalized root and canonical confinement of existing path ancestors, including Windows junction targets. Reads reject symbolic links and files larger than 100 KB; listings cap at 500 entries and skip build/dependency directories. Read/list tools exclude configured `DATA_DIR`, the conventional workspace `data/` subtree and root `.env`/`.env.*` files through lexical and canonical paths. `.env.example` is an explicit readable template exception. Approved writes retain their existing approval and path policy. Protect the installation from untrusted concurrent filesystem replacement; canonical checks do not lock the tree against such changes.

Focus, Night light, microphone privacy, and Battery saver are approved Settings shortcuts. Their results confirm a URI opened, not a hardware state change. Only Wi-Fi and Bluetooth are supported direct toggles. Runtime lifecycle requests require an owning supervisor; development terminals are managed manually.

## Performance diagnostics and experiments

Set `LIVE_DESKTOP_DIAGNOSTICS=1` in the launching process for at most 1,000 route timing records per backend lifetime. Logs contain route families/status/duration, not query strings, profile identities, messages, calendar events, or credentials. Browser diagnostics are separate.

With ports 4173/4317 free:

```powershell
.\scripts\measure-performance.ps1 -Label candidate -Launches 10
.\scripts\compare-startup-layouts.ps1 -Pairs 10
.\mvnw.cmd -pl backend '-Dlive.desktop.benchmarks=true' '-Dtest=StatePerformanceTest' test
```

The first script stages an isolated runtime, records runtime artifact hashes, and samples 100 direct/proxy reads per route plus fresh launches. The second compares the same artifact in JAR/extracted/CDS layouts with alternating order; it also records first system use and process working set. Raw results go under `backend/target/performance/`. Layout failures retain completed samples in a separate `*-layouts.partial.json` and per-sample logs, while cleaning up the isolated data directory and the Java process started by that sample. The opt-in state test compares 20 KiB/1 MiB/10 MiB histories and allocated bytes. Warm filesystem cache observations are not cold-machine results.

`startup-aot` is an experimental Maven profile for Spring AOT comparisons, not the production build. Use an isolated build and the startup comparison helper, then rebuild normal production artifacts before launch/package. Keep an experiment only after compatibility and performance evidence justify it. See [results and decisions](../docs/PERFORMANCE_RESULTS.md).
