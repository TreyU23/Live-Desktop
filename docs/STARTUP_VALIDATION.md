# Native production startup validation

Recorded October 9, 2026 on the development Windows machine.

## Implemented startup path

`start.cmd` invokes `native/build/Release/live-desktop-launcher.exe start`. The launcher creates a background C++ supervisor which starts Java directly with `-jar backend/target/live-desktop-backend.jar` and Node directly with `frontend/scripts/serve-production.mjs`. The frontend serves `frontend/dist/client` and proxies API/health requests to the backend. Production launch performs no PowerShell, Maven, pnpm, Vite, compilation, dependency install, or download.

The supervisor holds a current-user/workspace mutex in the global Windows namespace. It owns service processes and descendants in an unnamed Windows Job Object, assigns suspended children before resuming them, and monitors their process handles. Job handles are not inherited. Restart/shutdown terminate that job; supervisor termination closes it and kills remaining members. No cleanup target is inferred from an occupied port, executable name, or PID file. Listening-port inspection is a preflight; the services' own binds remain authoritative when another listener races startup. Cleanup waits for job members to exit and gives Windows a bounded interval to release listener state before restart.

## Verification

| Check | Result |
| --- | --- |
| Native Release build with MSVC/Windows SDK | Passed |
| CTest bridge protocol test | 1 passed |
| Maven package and backend tests | 34 passed, no failures/errors/skips |
| Built frontend and Sites packaging | Passed |
| Frontend tests, including production server | 21 passed |
| Separate Sites tests | 4 passed |
| Production startup integration script | Passed against final global-lock build |
| Real workspace `start.cmd` and launcher status | Passed; status reported running |
| Real backend health, built frontend, proxied health, runtime API | All returned HTTP 200 |

`scripts/test-production-startup.ps1` copies production artifacts into a temporary workspace under `backend/target`, uses a separate data directory, and removes only that verified test workspace. It verified:

- A repeated start reuses service PIDs, and two concurrent starts succeed through one supervisor.
- Backend health is available through the production frontend proxy.
- CLI restart replaces service PIDs and removes the old services.
- CLI shutdown removes both services and can be repeated safely.
- Dashboard API restart and shutdown return accepted responses and perform the requested lifecycle action.
- An unrelated Node HTTP listener on port 4173 survives a failed Live Desktop startup.
- Terminating the test-owned frontend causes the supervisor to remove its backend and exit.
- Terminating the supervisor removes backend, frontend, and an observed backend-owned Windows bridge descendant.
- A missing packaged JAR fails startup without becoming ready.

The production-server test also covers static MIME types, HEAD, SPA fallback, missing assets, encoded traversal/backslash rejection, invalid URI encoding, Host/Origin rejection, proxied method/query/body, and backend-unavailable responses.

## Timing and limits

Six successful service cycles in the final isolated run reported HTTP readiness at 7,781; 8,922; 6,531; 6,719; 7,235; and 7,406 ms from supervisor-cycle entry. The range was 6.53–8.92 seconds on this machine. These are a small warm-artifact observation, not a cold-start benchmark or an established speedup against the former launcher. They exclude browser rendering and optional integration readiness. Earlier development runs varied up to about 12.4 seconds.

The final real-workspace launch reached HTTP readiness in 8,390 ms and was left running. A dashboard browser preview was requested in Codex and returned queued; that UI request does not establish visual browser QA.

Readiness requires HTTP 200 from backend `/health` and frontend `/`, within a 60-second budget. Cleanup forcibly terminates processes and does not drain in-flight requests. Cross-session naming follows Windows' global-object semantics, but separate Windows sessions/users were not exercised live. Hardware mutations, external app launching, sleep/resume, and UI click automation are outside this startup test. AppCDS, Spring AOT, and GraalVM are unimplemented.
