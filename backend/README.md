# Backend

Java 21/Spring Boot 4.1 owns HTTP APIs, profiles, persistence, approvals, OpenAI orchestration, iCloud CalDAV and Phone Link JSON parsing. Default bind: `127.0.0.1:4317`. [Root setup/configuration](../README.md).

## Build and run

```powershell
.\scripts\build-production.ps1
.\start.cmd
```

For development, `scripts/run-backend.ps1` checks the built bridge/DLL, selects the local JDK and runs Maven. Stop the backend before replacing its loaded DLL. Production runs the extracted JAR/`lib/`, with build-time CDS, from `backend/target/runtime/`. The backend imports only the install-root `.env` (`${LIVE_DESKTOP_ROOT:..}/.env`), never `backend/target/.env`. The supervisor imports root `.env`, fixes loopback address, port and workspace root with command-line arguments (which outrank any `.env` setting such as `server.address` or `assistant.workspace-root`) and resolves relative `DATA_DIR` against `backend/`.

## API

`web/AssistantController.java` defines routes; consequential actions retain profile approval policy.

| Method and route | Purpose |
| --- | --- |
| GET `/health`, `/api/profile/settings` | Health/non-secret key availability |
| POST/DELETE `/api/profile/openai-key` | Save/remove protected key |
| DELETE `/api/profile/data` | Delete non-default profile records |
| GET `/api/conversations`, `/api/conversations/{id}`; POST `/api/chat` | History/assistant replies |
| GET/POST `/api/memories`; DELETE `/api/memories/{id}` | Memory reads/writes/deletion |
| GET `/api/actions`; POST `/api/actions/{id}/approve` or `/reject` | Actions/decisions |
| GET `/api/system`, `/api/system/apps`; POST `/api/system/controls/{id}` | Telemetry (incl. network/disk B/s rates)/controls |
| GET `/api/runtime`; POST `/api/runtime/{action}` | Owned lifecycle |
| GET `/api/integrations/phone-link`; POST `/open` on that route | Metadata/external launch |
| GET/DELETE `/api/integrations/icloud-calendar`; POST `/connect`, `/open`, `/open-web` on that route | Agenda/disconnect/connect/external Calendar or iCloud web |
| GET `/api/integrations/media-session`, `/artwork/{version}` on that route; POST `/{action}`, `/open-external` | Metadata/artwork/control/external music launch |

`X-Profile-Id` selects records: default uses `data/`, others `data/profiles/<id>/`. A missing or blank header means `default`; any other value must be the UI's `crypto.randomUUID()` form with `_` for `-` (lowercased before use), and anything else gets `400` `{"error":...,"code":"invalid_profile"}` rather than the default profile's data. A profile exists once its folder does: reads for a profile with no folder return empty data and write or cache nothing, and the first write creates the folder, up to 64 profile folders. Chat conversation ids are always made by the server; an unknown UUID starts a new conversation (the response carries its id) and a malformed one gets `400`. Request context clears afterward. Every request holds a shared profile lease; only profile deletion (`DELETE /api/profile/data`) takes the exclusive lock, from inside the deletion itself, so other DELETEs never queue behind a chat. Deletion waits for in-flight profile work, but chats release their lease around each OpenAI call; a chat whose profile was deleted meanwhile stops without saving and returns `409`. Profiles do not authenticate Windows users. State format remains version 1. Targeted defensive reads avoid unrelated history; writes atomically replace disk state before publishing memory state. Approval persistence is synchronous.

`LocalAccessFilter` runs before profile handling. Each launch creates a 32-byte token and returns it in the `X-Live-Desktop-Token` response header on `GET /health` only when the TCP peer is loopback (`127.0.0.1`, `localhost`, `::1`, or `0:0:0:0:0:0:0:1`) and, when the launcher set `LIVE_DESKTOP_BRIDGE_SECRET`, the request carries it in `X-Live-Desktop-Bridge` (the native host adds that header to its `/health` proxy call and strips any client-sent copy). The health JSON contains `status` and `openAiConfigured`. The token is not part of that body. Every other method and route requires that header. `Host` must be `127.0.0.1` or `localhost` with the accepting port. A missing `Origin` is accepted for same-origin and local clients. A present `Origin` must be `http://127.0.0.1` or `http://localhost` on port `4173` or the backend port; `null` and any other origin are rejected. `POST` and `DELETE` require a single `Content-Type: application/json` (a charset parameter is accepted). The filter reads `Host` and `Origin` directly. Rejected calls return `403` `{"error":"Local access only"}` and do not create, approve, or run actions.

Error responses carry `{"error": <message>, "code": <stable code>}` (`ClientErrors`). Only messages Live Desktop wrote itself (validation and status text) are passed through; JDK, file-system, parser and OpenAI SDK errors become a code such as `internal_error`, `openai_unauthorized`, `openai_rate_limited`, `openai_error` or `openai_unreachable` with a generic message and a short reference, and the full exception is logged under that reference. Tool results the model sees and failed-action messages use the same rules, so neither carries local paths or upstream error text. An allowlisted dashboard origin receives CORS headers for direct calls to the backend port; private-network access is not enabled.

## Integration lifecycle

| Component | Bounds and behavior |
| --- | --- |
| Bridge | One lazy owning-PID-checked peer; serialized calls. Queue wait and the call have separate 15-second budgets: a call that waits too long returns `BRIDGE_BUSY` without touching the bridge, and only a dispatched call that fails or overruns restarts it. Ambiguous mutations never replay. Later requests reconnect. |
| System/phone | Static specs cache for backend lifetime, battery 5 minutes, radio 30 seconds. Native process/package snapshots last 2 seconds; explicit phone refresh bypasses these and local JSON cache. JSON caps at 1 MiB/file, caches by size/mtime up to 30 seconds, rejects partial/replaced reads. `system.ioCounters` cumulative samples become B/s only when elapsed time is 1s–5min; first sample/gaps/resets stay unavailable rather than zero. Windows URI allowlist includes `outlookcal:` and `spotify:` alongside Settings/Phone Link. |
| Calendar | Up to 32 profiles, 8 cached/pending dates/profile, 4-minute date cache, 30-minute discovery, 4 active fetches. Network work avoids the global cache lock; refresh budget/error retry cache: 15 seconds. Reconnect/disconnect/removal invalidate pending results; stale events stay only for the same date. |
| OpenAI | Up to 16 clients by profile/key fingerprint, one retry each. Rotation/removal/eviction retires clients after active leases finish. Up to 8 tool rounds within a 240-second overall deadline; each model call's timeout is sized from the time left. Past the deadline `/api/chat` returns `504` and saves no reply. Selective dashboard context; no streaming. |
| Artwork | Opaque versions, 4 native entries up to 4 MiB each. Java validates PNG/JPEG/GIF/WebP signatures; responses use private caching and `nosniff`. Snapshots carry references, not Base64. |

Calendar validates Apple-owned HTTPS destinations/redirects before sending credentials; recurrence/timezones use ical4j. Credentials use current-user DPAPI through JNI, never bridge IPC. Settings returns status; usable keys or the default-profile environment fallback determine availability. Secrets remain in managed memory while used.

State is stored per profile in `assistant-state.json` as compact JSON, written to a temporary file and moved into place, under one lock per profile. A finished file write keeps only its path, content SHA-256 and size (older files are trimmed on load), and at most 1,000 finished actions are kept; pending and approved ones are never dropped.

Workspace canonical checks reject escapes through existing ancestors/junctions. Reads cap at 100 KB, listings at 500 entries and skip build/dependency directories. Read/list tools exclude configured/conventional data directories and root `.env` variants, except `.env.example`. Writes go through `resolveWritablePath`, which also refuses Live Desktop's own folders, every `.env`/`.env.*` file, executable and loadable extensions, trailing-dot/space and 8.3 short names, and alternate data streams. A write approval key is the normalized path plus the SHA-256 of the content, and failed actions never count as prior approvals. Protect the installation against concurrent untrusted replacement.

Focus/Night light/Mic privacy/Battery saver are approved Settings launches, not confirmed state changes. Lifecycle actions need a production supervisor. [Native protocol](../native/README.md), [system inventory](../docs/SYSTEM_INFORMATION.md), [validation/performance](../docs/VALIDATION.md).
