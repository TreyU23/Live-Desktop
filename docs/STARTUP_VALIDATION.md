# Native production startup validation

Recorded October 9, 2026 on the development Windows machine.

## Implemented startup path

`start.cmd` invokes `native/build/Release/live-desktop-launcher.exe start`. The launcher creates a background C++ supervisor which starts Java directly with `-jar backend/target/live-desktop-backend.jar` and `live-desktop-host.exe --root WORKSPACE`. The frontend serves `frontend/dist/client` and proxies API/health requests to the backend. Production launch performs no Node, PowerShell, Maven, pnpm, Vite, compilation, dependency install, or download. The native host uses Winsock for loopback HTTP and WinHTTP for API proxying.

The supervisor holds a current-user/workspace mutex in the global Windows namespace. It owns service processes and descendants in an unnamed Windows Job Object, assigns suspended children before resuming them, and monitors their process handles. Job handles are not inherited. Restart/shutdown terminate that job; supervisor termination closes it and kills remaining members. No cleanup target is inferred from an occupied port, executable name, or PID file. Listening-port inspection is a preflight; the services' own binds remain authoritative when another listener races startup. Cleanup waits for job members to exit and gives Windows a bounded interval to release listener state before restart.

## Verification

| Check | Result |
| --- | --- |
| Native Release build with MSVC/Windows SDK | Passed |
| CTest bridge protocol test | 1 passed |
| Maven package and backend tests | 34 passed, no failures/errors/skips |
| Built frontend and Sites packaging | Passed |
| Frontend tests | 20 passed |
| Native host test suite | 9 passed (parent plus 8 behavior checks) |
| Separate Sites tests | 4 passed |
| Production startup integration script | Passed with native host and readiness metrics |
| Extracted ZIP, SHA-256 manifest, bundled Java, no Node/build tools on launcher PATH | Passed |
| Missing native host and invalid native host diagnostics | Passed |
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

The native-host test covers static MIME types, HEAD, SPA fallback, missing assets, encoded traversal/backslash rejection, invalid URI encoding, Host/Origin rejection, proxied method/query/body/profile/auth headers, streamed responses, multiple cookies, redirect passthrough, chunked bodies, ambiguous framing, request limits, junction escape, and backend-unavailable responses.

## Timing and limits

The first native-host lifecycle run observed fresh start/restart command times of 6,828; 7,250; 8,531; 8,579; and 9,625 ms. Restart command time includes cleanup. These are small warm-artifact observations on this development machine, not a cold-start benchmark or a speedup against a matched Node baseline. They exclude browser rendering and optional integration readiness.

The extracted package run observed command times of 6,562; 6,562; 7,219; 7,297; and 9,000 ms (median 7,219 ms). Native host readiness from supervisor entry was 437; 125; 156; 140; 172; and 157 ms over six service cycles. The package contained 520 entries, including Java 21 and the hidden configuration template, with no private data/settings/logs or frontend dependency folders. Manifest hashes passed. Launcher calls succeeded with JAVA_HOME empty and only the Windows System32 directory on PATH, using the included Java runtime.

Every successful supervisor cycle appends `services-ready` to `.startup-metrics.jsonl`: `host_ready_ms`, `backend_ready_ms`, `proxy_ready_ms`, and `services_ready_ms` measured from supervisor cycle entry. Successful CLI commands append `launch-ready`: `launch_to_ready_ms`, action, and reused-instance flag. Existing ready instances return quickly and should be excluded from fresh-launch comparisons. Restart through the API records supervisor stages; only a subsequent CLI wait records a CLI command measurement.

Readiness requires host identity from `/_live/ready`, HTTP 200 with backend health from direct and proxied `/health`, and HTTP 200 from frontend `/`, within a 60-second budget. A missing artifact fails immediately. Child failure names the component and exit code; timeout failure identifies unfinished host/backend/proxy checks. The foreground command includes new supervisor log details. These checks establish HTTP availability, not browser rendering or completion of external integrations.

The native targets statically link the MSVC runtime. `scripts/package-production.ps1` creates `dist/Live-Desktop-windows-x64.zip` with four native binaries, backend JAR, client assets, documentation, configuration template, and SHA-256 manifest. `-IncludeJavaRuntime` additionally includes the project-local Java 21 installation. Without it, Java 21 is required separately. No Node/build tools are required for normal use.

`scripts/test-production-startup.ps1 -PackagePath PATH` extracts only the package artifacts into the test workspace, verifies manifest hashes, and runs lifecycle checks. Normal CLI start/restart/shutdown run with Node/build-tool directories removed from PATH. Missing host and deliberately invalid host binaries verify the diagnostics. Separate test data and owned processes are removed afterwards.

Cleanup forcibly terminates processes and does not drain in-flight requests. Cross-session naming follows Windows' global-object semantics, but separate Windows sessions/users were not exercised live. Hardware mutations, external app launching, sleep/resume, and UI click automation are outside this startup test. AppCDS, Spring AOT, and GraalVM are unimplemented.
