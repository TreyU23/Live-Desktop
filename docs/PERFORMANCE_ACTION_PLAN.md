# Dashboard performance action plan

Delivery update — October 10, 2026. Implementation and automated validation are complete for the adopted changes. Hardware/account and total-application CPU/memory gates remain unverified; see the [results and remaining checks](PERFORMANCE_RESULTS.md).

Based on the [performance and migration assessment](PERFORMANCE_MIGRATION_ASSESSMENT.md), inspected against source commit `ec99bce`. Existing observations guide priorities; they are not a controlled baseline or promised speedups. This plan separates dashboard responsiveness, native integration work, and startup work so each can be evaluated independently.

## Intended outcome and architecture

Make useful dashboard content appear sooner, keep controls responsive during integration refreshes, reduce background work, and shorten fresh-process startup. Preserve profile isolation, approvals, durable state, credential protection, playback continuity, and existing local-first behavior.

Keep React for presentation and Java for application policy/network orchestration initially. Improve the existing C++ host and Windows bridge, migrating additional Java work only when profiles demonstrate a useful end-to-end gain. Removing small Java adapters will not remove JVM startup or its baseline memory footprint. No duplicate legacy integration provider needs removal according to the assessment.

## Proposed success criteria

These are initial engineering targets, not measured outcomes or commitments. Phase 0 will establish repeatable baselines and identify targets that need adjustment before implementation comparisons.

| Area | Initial acceptance target |
| --- | --- |
| Independent loading | With a calendar response deliberately delayed 10 seconds, ready core widgets render within 250 ms of their own response completion and do not wait for calendar |
| Polling | At most 32 scheduled first-party requests/minute in the defined visible dashboard scenario, compared with the current nominal 64; exclude startup and user actions |
| Hidden dashboard | Stop routine widget polling while hidden; resume with one deduplicated refresh on return; playback remains uninterrupted |
| Refresh correctness | At most one in-flight read per resource/profile key; late results never overwrite newer state or another profile |
| State access | Small-list reads no longer serialize all conversation messages; measure latency and allocations at 20 KiB, 1 MiB, and 10 MiB synthetic state sizes |
| Media artwork | An unchanged track does not reread/re-encode/retransfer artwork on each five-second playback refresh; caches have tested bounds |
| Controls | UI acknowledges a click within 100 ms in the controlled browser test; separately measure confirmed completion and bridge queue delay under slow-read load |
| Startup | Aim for at least 25% lower median fresh-process readiness time against the matched Phase 0 baseline, without delaying first usable widgets or controls |
| Regression boundary | No material repeatable regression in tail interaction latency, total application/browser CPU, or memory; investigate changes greater than 10% under matched conditions |

Use explicit captured timestamps to distinguish immediate pending feedback from a confirmed hardware change. Baselines close to zero need absolute CPU-time comparisons, not misleading percentage ratios. External network latency is recorded separately and does not excuse blocking local widgets.

## Delivery order

| Batch | Scope | Dependency | Completion evidence |
| --- | --- | --- | --- |
| P0 | Instrumentation and repeatable baseline | None | Baseline report and reproducible scenarios |
| P1 | Independent widget loading and refresh scheduling | P0 | Delayed integration/profile-switch/browser tests and request counts |
| P2 | Targeted Java state reads and Phone Link parsing | P0; validate combined with P1 | Allocation/history-size comparisons and state correctness tests |
| P3 | C++ media/process caches and bridge responsiveness | P0; stabilize P1 refresh contracts first | Active-media payload/CPU comparisons and slow-read/control tests |
| S1 | Extracted backend packaging and Java 21 CDS | P0 | Matched launch comparisons and extracted-package lifecycle tests |
| P4 | Calendar/client lifecycle and frontend assets | P1/P2; cache contracts from P3 where applicable | Integration correctness, browser trace, and payload comparisons |
| P5 | Native host connection/cache improvements | P0/P1 measurements justify scope | Host regressions and paired proxy measurements |
| S2 | Spring AOT; conditional native executable experiment | S1 results | Measured startup/memory benefit plus full compatibility coverage |
| R1 | Release candidate and documentation cleanup | Selected batches complete | End-to-end report, package checks, and security review |

Runtime and startup tracks can be developed independently after P0, but benchmark each against a fixed artifact set before combining them. Each batch should be a focused reviewable change; split protocol, storage, and packaging changes further where necessary. No calendar delivery dates are assigned until the baseline and first implementation batch establish effort.

## P0 — Establish the baseline

1. Record source revision, artifact hashes, JDK/build versions, machine/power conditions, selected profile, browser version, and integration state. Use isolated synthetic data for repeatable tests; never record credential values, messages, or calendar contents in timing logs.
2. Add bounded opt-in diagnostics: browser request start/end and widget commit marks; backend route duration; bridge enqueue/start/end; payload size and native operation duration. Use JFR/allocation sampling and a browser performance trace where they resolve an actual bottleneck.
3. Capture first paint, first useful core widgets, each optional integration ready, and click-to-pending/click-to-confirmed times. Keep them separate from launcher HTTP readiness.
4. Exercise visible idle, hidden dashboard, active music with artwork, slow/unavailable calendar, profile switching, growing histories, simultaneous windows, and slow native reads.
5. Collect at least ten matched fresh-process launches per startup candidate. Distinguish warm filesystem-cache launches, restart including cleanup, and cold-machine observations. Exclude reused-instance starts. For runtime sampling, use at least 100 reads per representative route and five-minute visible/hidden observation windows; report sample counts and median/p95 without overstating confidence.
6. Save a concise reproducible results report with raw non-sensitive timing data. Record browser/iframe costs separately from Java, host, launcher, and bridge costs.

Primary locations: `frontend/src/App.jsx`, backend request/bridge boundaries, `native/launcher/main.cpp`, `native/windows-bridge/`, and `scripts/` benchmark helpers. Instrumentation must be inexpensive when disabled, bounded when enabled, and removable without changing application behavior.

Exit: identify where time/CPU is actually spent and finalize comparison targets. The existing 7.8-second startup observation and 10-second quiet CPU sample remain historical reference points only.

## P1 — Make loading independent and control refresh work

1. Extract resource-loading logic from the monolithic dashboard effect. Apply each successful result immediately and maintain per-widget loading/error/stale state.
2. Separate core local data from calendar/music/phone readiness. Give optional reads deadlines and preserve useful last-known data with truthful status.
3. Introduce one in-flight read per resource/profile key, cancellation on unmount/profile changes, generation checks for late responses, and scheduling after completion instead of overlapping intervals. Manual refresh must have defined behavior when a read is already pending.
4. Use one Phone Link refresh owner. Refresh actions/history/memories/settings after relevant mutations, with slower reconciliation for changes from another window. Keep active media updates responsive. Pause routine hidden-tab polling and refresh once when visible again.
5. Keep frequent media updates local to the player where practical. Preserve profile-scoped settings, approval behavior, and continuous playback.

Primary files: `frontend/src/App.jsx`, new focused hooks/helpers, `frontend/tests/`. Use Impeccable for interface changes, preserving the current layout and styling. Add browser coverage for real scheduling/state behavior; existing helper tests alone cannot establish widget rendering correctness.

Exit: meet independent-loading, polling, and stale-response criteria; demonstrate that a 10-second calendar delay does not freeze local content, and that rapid profile changes never show another profile's results.

Rollback: revert the focused frontend change and rebuild the prior assets. No persisted schema changes in this batch.

## P2 — Remove unnecessary Java data work

1. Add targeted state accessors for action lists, memories, conversation summaries, and a selected conversation. Avoid Gson round trips over unrelated history while retaining defensive copies of mutable data.
2. Update controller/service consumers together. Keep existing response compatibility first; introduce pagination in a separate API/UI change if history benchmarks justify it.
3. Separate profile state locking where useful, retaining atomic writes and correct coordination with profile deletion/cache invalidation. Do not debounce approval/action persistence or silently weaken durability.
4. Read Phone Link companion metadata once per refresh and derive both battery/notification fields from it. Add a bounded modification-time/size-aware cache with explicit refresh invalidation and safe handling of partially written files.

Primary files: `StateStore.java`, `AssistantController.java`, `ActionService.java`, `MemoryService.java`, `SystemService.java`, and their tests.

Exit: semantic equality for existing responses; no mutable internal state escapes; concurrent profile access/deletion and persisted action recovery remain correct; benchmark across all synthetic state sizes. Consider a database only if remaining full-file write cost is material after these changes.

Rollback: keep the saved-state format unchanged for this batch so the previous application package remains usable.

## P3 — Optimize the C++ bridge before expanding it

Deliver as three smaller changes:

1. **Shared observations:** reuse a bounded short-lived process/package snapshot for app and Phone Link queries. Define freshness and explicit refresh behavior; test process changes and sleep/resume.
2. **Media data separation:** retain session metadata/artwork until change notification or bounded revalidation. Send small playback snapshots and an opaque artwork version/reference. Use a bounded image cache and serve bytes through a constrained route; do not expose arbitrary filesystem paths. Keep transitional response compatibility only within this coordinated rollout, then remove it.
3. **Responsiveness under slow reads:** include queue wait in the overall request budget and expire reads before dispatch if their deadline has passed. Reduce slow work on the serialized pipe first. If control latency remains poor, design a dedicated bounded work path with explicit request routing and WinRT thread ownership; do not merely remove the Java lock.

Primary files: `native/windows-bridge/capabilities.cpp`, `native/windows-bridge/main.cpp`, `WindowsBridgeClient.java`, `WindowsMediaSessionService.java`, media API routes, and frontend media helpers.

Preserve request IDs, response limits, owning-PID checks, current-user isolation, and no automatic mutation replay. A timeout after dispatch remains an ambiguous result requiring state refresh. Do not bypass Java approval policy to accelerate a control.

Exit: unchanged artwork is fetched/transferred once while valid; cache memory remains bounded; track/provider changes invalidate correctly; slow artwork does not cause an unbounded queue of controls. Validate active playback, unavailable sessions, corruption/oversized artwork, bridge restart, and sleep/resume. Record live hardware/media checks separately from simulated tests.

Rollback: restore the matching frontend/backend/native artifact set as one unit; never mix incompatible protocol versions.

## S1 — Shorten Java startup without changing application logic

1. Package and launch Spring Boot's extracted deployment layout. Update artifact preflight, package manifest, installation verification, and working-directory handling together.
2. Benchmark extracted layout alone, then add application CDS for Java 21. Train only with isolated non-secret data, not the user's profile or external accounts.
3. Tie archives to the application artifact and compatible JDK identity/options. Rebuild archives during packaging; keep compilation/training out of normal launch. Define an explicit diagnostic path for an invalid archive without adding another legacy integration provider.
4. Preserve current startup stage measurements and add first-use observations. Do not move work to the first control merely to improve the launcher number.

Primary files: `native/launcher/main.cpp`, `scripts/build-production.ps1`, `scripts/package-production.ps1`, `scripts/test-production-startup.ps1`, and backend build configuration.

Exit: matched evidence against the 25% target, correct lifecycle cleanup, successful extracted ZIP startup, missing-artifact diagnostics, and unchanged first-use behavior. Even a smaller benefit can be considered if complexity is low, but document the tradeoff explicitly.

Rollback: retain the prior complete runtime ZIP externally as the rollback artifact. Ship one documented production layout; remove superseded setup commands after selecting the new one.

## P4 — Improve network integration and browser payload efficiency

Calendar: cache account discovery separately from date results, use bounded per-profile/date caches, and allow only one refresh per key. Move network work out of service-wide locks. If refreshing in background, explicitly capture profile identity; do not depend on request-thread context. Disconnect/key changes/profile deletion must invalidate pending results so old credentials or events cannot repopulate caches. Test recurrence, daylight-saving boundaries, all-day events, stale/error states, and bounded fetch concurrency.

Assistant: reuse a bounded profile-scoped SDK client only after defining closure/invalidation on key changes, profile deletion, eviction, and shutdown. Avoid caching by plaintext key. Evaluate streaming separately; preserve tool-call/approval semantics and confirm native-host worker capacity before adding long-lived streams.

Frontend: optimize image dimensions/formats for their rendered use, defer infrequently used views when profiling supports it, and evaluate first-mount deferral for the selected music embed. Once mounted for playback, preserve it across view navigation. Retain immediate access to the player and profile/provider isolation.

Exit: lower measured payload/work without visual regression, calendar correctness loss, leaked clients, or interrupted audio. Compare cold and cached loads, and count third-party iframe work separately.

## P5 — Improve the native host where measurements justify it

Start with cache headers/validators: immutable caching only for content-hashed assets, revalidation for HTML and stable filenames, and a correct 304 response path. Do not accidentally cache profile APIs, credentials, or private results in shared storage.

Next evaluate a reusable WinHTTP session/connection strategy with per-request headers and correct response cleanup. Treat browser keep-alive as a separate change with request framing, timeouts, bounded connection handling, and shutdown tests. The current host uses 16 blocking workers; long-lived streams and idle connections must not exhaust capacity.

Exit: paired direct/proxy comparison shows useful improvement; native-host tests still cover Host/Origin validation, path confinement, body framing, streaming, cookies, backend failure, and resource bounds. Prioritize correctness over saving the previously observed few milliseconds.

## S2 — Decide whether a native backend is warranted

1. Benchmark Spring AOT on the JVM after S1; test configuration, packaging, dynamic application profiles, JNI, and resources. Keep it only if total startup/first-use performance improves enough to justify its build requirements.
2. If targets remain unmet, compare a GraalVM executable with the best JVM candidate. Scope the experiment to API/profile/state behavior, OpenAI, calendar/timezones, TLS/resources/reflection, DPAPI JNI, and bridge ownership. Measure build/release complexity, startup, active CPU, memory, and sustained requests.
3. Treat Java 25+ JVM AOT caching as a separate optional runtime-upgrade experiment; the current runtime is Java 21. Verify pinned-version documentation when implementing either experiment.
4. Migrate Phone Link parsing or dynamic system sampling to C++ only when the remaining path contributes materially to the measured bottleneck and a prototype improves end-to-end performance after IPC/cache costs. Preserve API contracts and remove the replaced implementation after validation.
5. Reconsider a full C++ backend only if explicit performance targets remain unmet and the smaller experiments do not suffice. Produce a separate scope/cost/compatibility decision before rewriting profiles, approvals, persistence, calendar semantics, and network orchestration.

Do not add WebAssembly or a native C++ UI without a demonstrated browser computation bottleneck. Do not replace the OpenAI SDK solely because its JAR is large; package size and resident memory are different metrics. A trimmed Java runtime can be a separate distribution-size improvement.

## R1 — Validation, cleanup, and release preparation

Run focused tests for each batch, then perform integrated validation for the selected artifact set:

- Native build/CTest and `scripts/test-windows-bridge.ps1` for protocol/read-only operations.
- Maven backend tests, including profile isolation, persistence, credentials, and relevant integration cases.
- Frontend tests/build and Sites compatibility tests; add browser tests for independent rendering and lifecycle behavior.
- `scripts/test-native-host.ps1` for serving/proxy behavior.
- `scripts/test-production-startup.ps1` against the packaged runtime for launch/reuse/restart/shutdown and ownership.
- Active-dashboard performance comparisons, real playback checks, and separately documented hardware/sleep/resume validation. Mock tests do not substitute for these.
- Codex Security review before shipping to `main`, especially for artwork routes, connection reuse, concurrency, JNI, and cache/profile boundaries.

Inspect the build scripts rather than assuming the production build runs every suite: the current build runs native protocol CTest, packages/tests the backend, and tests/builds the frontend. Browser, native-host and lifecycle suites run separately.

Each behavior/configuration change updates the relevant root/backend/frontend/native README in the same batch. Remove superseded setup paths and transitional providers. Update the assessment with links to new evidence, preserving historical measurements as historical. Check diff scope and whitespace before commits; publishing remains a separate release action.

Rollback uses the previous complete artifact package, with data compatibility verified. Any later storage-format change requires its own backup/migration/rollback design before implementation. Do not keep duplicate old providers running as a permanent rollback mechanism.

## First implementation batch

Begin with P0 plus the smallest P1 change: establish delayed-calendar/profile-switch browser coverage, remove the all-results loading barrier, and protect against stale responses. Validate that widgets become independently usable before changing refresh frequencies, native protocols, or startup packaging. Then implement controlled refresh scheduling as the next focused change.

## Delivery decisions

| Batch | Delivered outcome | Evidence and limits |
| --- | --- | --- |
| P0 | Bounded opt-in Java/bridge/browser diagnostics; ten baseline and candidate fresh launches; 100 reads per direct/proxy route; browser polling and synthetic history baselines | Raw files in `docs/performance/`; polling timers accelerated; separate real-time browser CPU samples; total application CPU/memory not measured |
| P1 | Independent resource commits, completion-based polling, cancellation/generations, targeted mutation invalidation, hidden pause/resume | Delayed Calendar, commit timing, dedup/stale unit tests, profile headers, pending feedback, iframe retention |
| P2 | Targeted defensive state reads; durable write before publish; Phone metadata cache; exclusive profile deletion coordination | State sizes 20 KiB/1 MiB/10 MiB, allocation data, persistence failure/reload/profile tests |
| P3 | Two-second shared app cache; event/revalidation media cache; opaque constrained artwork route; bounded source cache; queue wait included in bridge deadline | Native protocol, bridge and host tests; real active playback, sleep/resume, saturation and hardware confirmation still require a dedicated session |
| S1 | Build-time extracted deployment and Java 21 CDS; identity check and safe JVM fallback | Matched layout measurements; launcher tests include absent/corrupt CDS; final package validation |
| P4 | Profile/date Calendar cache, bounded concurrent fetches, client pool with rotation leases, named icon imports, deferred persistent music embed | Calendar race/dedup/recurrence/DST tests, client lifecycle tests, browser iframe check; view splitting and image conversion not selected without evidence |
| P5 | Conditional static ETags; immutable hashed assets | Host conditional/changed-asset tests. WinHTTP/browser connection reuse not selected: measured proxy overhead is small and lifecycle/framing complexity needs evidence |
| S2 | Isolated Spring JVM AOT build and ten alternating layout samples | Kept experimental; production uses CDS. No GraalVM/full C++ rewrite selected after startup median target was met |
| R1 | Complete source inventory and focused correctness review; managed security diff scan; all four READMEs rewritten; build/package/test checks | Static/security scope and remaining live checks are explicitly recorded in the results report |

These decisions close implementation selection, not every original acceptance gate. Do not interpret accelerated polling or static cache checks as real audio, hardware, CPU, authenticated account, or sleep/resume validation. No commit, push, merge, publication or release was performed.
