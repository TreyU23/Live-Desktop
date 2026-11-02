# Flight Deck implementation validation

Implementation work dated November 1, 2026. Baseline: `5d7539fed256744b56b0a7201cab773a3adc530c`. This record covers the local working tree, not a published release. The original [concept validation](../VALIDATION.md) remains historical.

## Delivered interface

All seven views use the Flight Deck shell and tokens. Overview prioritizes real PC instruments, with a control rail, connected services, recent applications and secondary text composer. System Info retains hardware/Windows fields and adds CPU, memory and storage bars. Approvals shows pending/history, full targets/content/results and reusable scope; memory categories filter locally; conversations and both composers retain failed drafts. Calendar expands the selected day, sorting all-day events separately; Phone details exposes the existing local metadata and external actions. Settings preserves profile-scoped provider links, write-only credentials, light/dark and saved accents. Shutdown and eligible profile deletion use focus-contained confirmations.

The scheduler, API routes, ports, backend authorization, native execution and storage schema remain unchanged. First successful reads and error/recovery now publish resource presentation state; healthy poll starts remain in refs. Wall-clock freshness is distinct from performance timing. Missing values are unavailable, real zero is retained, and failed reads keep last-known values with retry. Unsupported voice input was removed.

## Automated evidence

| Check | Result and scope |
| --- | --- |
| Baseline unit/build/Sites | 23 unit tests and 4 Sites checks passed. CSS 47.26 kB / 9.24 kB gzip; JS 290.28 kB / 85.25 kB gzip. |
| Candidate unit/build/Sites | 28 unit tests and 4 Sites checks passed; client/server/Sites outputs preserved. CSS 31.76 kB / 6.93 kB gzip; JS 305.39 kB / 89.85 kB gzip. |
| Seven-view browser matrix | 42 combinations passed: 1920x1080, 1440x900, 1280x720, 768x1024, 390x844, 320x740. No horizontal document/view overflow; dock reserves space. |
| Interaction checks | Control scope, literal untrusted file text, unknown action handling, Home/conversation failed drafts, shutdown tab containment/Escape/focus return, profile panel Escape, saved light/yellow accent, calendar/phone expansion, first-load versus zero, stale system retry. |
| Existing mutation suite | Passed: mutation-time read cannot overwrite confirmed radio state; failed memory save retains draft; successful save clears it despite refresh failure. |
| Existing performance suite | Passed: ten-second Calendar delay does not block core data; pending control feedback within 50 ms; Apple iframe continuity; switched-profile request headers. |
| Matched polling | Edge 157.0.4341.30: baseline 156 and candidate 155 requests per five simulated visible minutes; both 0 hidden requests. Timing explains small count differences; this is not a speedup claim. |
| Native host | 10 tests passed: assets/SPA/MIME, traversal/junction confinement, cache policy, Host/Origin, proxy headers/framing/body/streaming/cookies and upstream failure. |
| Backend | Cached offline Maven/JDK package succeeded: 51 tests, 0 failures/errors, 1 intentionally skipped performance test. No backend source changes. |
| Native build | C++ binaries compiled and the bridge-protocol test passed. The monolithic production command stalled at sandboxed Java test-agent attachment; subsequent build stages were run individually. |
| Isolated runtime | Built dashboard/native host/real backend smoke passed with no page errors. Lifecycle suite passed duplicate/concurrent start, CLI/API restart/shutdown, occupied-port isolation, failure cleanup and missing-artifact checks. |
| Exact distribution | Created `dist/Live-Desktop-windows-x64.zip` with bundled Java, preserving the previous ZIP. Extracted-package manifest/hash checks, real dashboard/backend smoke and the full lifecycle suite passed. The freshly tested backend runtime was extracted and CDS training completed through the native runtime. |
| Design detector | Ran once over changed App/components/views/styles; returned `[]`. |
| Design review | Two material findings: missing System Info bars and nullable percentages. Both were fixed and independently scored resolved; verdict `ship` covers those two fixes. |

Browser checks use synthetic accounts, system data, events and actions. No fixture content enters production UI. Review captures and machine-readable results are generated under `backend/target/redesign/`; existing request evidence stays under `backend/target/performance/`. The pinned baseline capture script reconstructs original source/styles from the exact commit. Browser tests use an isolated loopback preview; `BROWSER_TEST_BASE_URL` and `PLAYWRIGHT_EXECUTABLE_PATH` can select the test server/browser.

The 640x360 CSS viewport check approximates 200% zoom at 1280x720. Actual browser UI zoom, a screen-reader pass, authenticated playback, account responses, and hardware changes are separate checks; synthetic results do not establish those.

## Remaining release gates

- Git branch/commit/draft PR creation is blocked by the session's read-only `.git` boundary. Work remains in the existing checkout; no remote changes were made.
- Formal Codex Security diff scan could not start because its required scan MCP is unavailable. This is not a clean formal scan result.
- Production build stages, packaged-runtime checks and lifecycle checks passed individually. The monolithic build command did not complete inside the restricted process; the equivalent stages were run separately, including cached offline backend tests/package and native runtime extraction/CDS. FD-16 remains open for authenticated account/device checks.
- OpenAI requests, authenticated iCloud/Apple Music/Spotify, Phone Link notification availability, and physical radio changes require a suitable test account/device and are unverified in this pass.
- Distribution publication remains FD-18 and requires separate release authorization.

## Rollback

Restore application source/package files from the pinned baseline or previous compatible distribution after stopping the owned Live Desktop instance through its supported lifecycle. Preserve `data/`, `.env`, profile-scoped browser storage and protected credentials. Never delete local profile data to undo a visual change. The redesign introduces no storage migration or permanent old/new UI preference.

The redesigned source installation was started with the supported native launcher at `http://localhost:4173`; the real page rendered System overview with no JavaScript page errors. Distribution SHA-256: `110517cdf5c7760cd7a03e8d5086dc0aa434c5fc206de27ba12bbbd2bb72298a9`.
