# Backend

Java 21/Spring Boot 4.1 owns HTTP APIs, profiles, persistence, approvals, OpenAI orchestration, iCloud CalDAV and Phone Link JSON parsing. Default bind: `127.0.0.1:4317`. [Root setup/configuration](../README.md).

## Build and run

```powershell
.\scripts\build-production.ps1
.\start.cmd
```

For development, `scripts/run-backend.ps1` checks the built bridge/DLL, selects the local JDK and runs Maven. Stop the backend before replacing its loaded DLL. Production runs the extracted JAR/`lib/`, with build-time CDS, from `backend/target/runtime/`. The supervisor imports root `.env`, fixes loopback/workspace settings and resolves relative `DATA_DIR` against `backend/`.

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

`X-Profile-Id` selects records: default uses `data/`, others `data/profiles/<id>/`. Request context clears afterward; deletion waits for in-flight profile requests. Profiles do not authenticate Windows users. State format remains version 1. Targeted defensive reads avoid unrelated history; writes atomically replace disk state before publishing memory state. Approval persistence is synchronous.

## Integration lifecycle

| Component | Bounds and behavior |
| --- | --- |
| Bridge | One lazy owning-PID-checked peer; serialized 15-second budget includes queue wait. Expired queued reads are not dispatched; ambiguous mutations never replay. Later requests reconnect. |
| System/phone | Static specs cache for backend lifetime, battery 5 minutes, radio 30 seconds. Native process/package snapshots last 2 seconds; explicit phone refresh bypasses these and local JSON cache. JSON caps at 1 MiB/file, caches by size/mtime up to 30 seconds, rejects partial/replaced reads. `system.ioCounters` cumulative samples become B/s only when elapsed time is 1s–5min; first sample/gaps/resets stay unavailable rather than zero. Windows URI allowlist includes `outlookcal:` and `spotify:` alongside Settings/Phone Link. |
| Calendar | Up to 32 profiles, 8 cached/pending dates/profile, 4-minute date cache, 30-minute discovery, 4 active fetches. Network work avoids the global cache lock; refresh budget/error retry cache: 15 seconds. Reconnect/disconnect/removal invalidate pending results; stale events stay only for the same date. |
| OpenAI | Up to 16 clients by profile/key fingerprint. Rotation/removal/eviction retires clients after active leases finish. Bounded tool rounds/selective dashboard context; no streaming. |
| Artwork | Opaque versions, 4 native entries up to 4 MiB each. Java validates PNG/JPEG/GIF/WebP signatures; responses use private caching and `nosniff`. Snapshots carry references, not Base64. |

Calendar validates Apple-owned HTTPS destinations/redirects before sending credentials; recurrence/timezones use ical4j. Credentials use current-user DPAPI through JNI, never bridge IPC. Settings returns status; usable keys or the default-profile environment fallback determine availability. Secrets remain in managed memory while used.

Workspace canonical checks reject escapes through existing ancestors/junctions. Reads cap at 100 KB, listings at 500 entries and skip build/dependency directories. Read/list tools exclude configured/conventional data directories and root `.env` variants, except `.env.example`. Approved writes retain approval/path checks. Protect the installation against concurrent untrusted replacement.

Focus/Night light/Mic privacy/Battery saver are approved Settings launches, not confirmed state changes. Lifecycle actions need a production supervisor. [Native protocol](../native/README.md), [system inventory](../docs/SYSTEM_INFORMATION.md), [validation/performance](../docs/VALIDATION.md).
