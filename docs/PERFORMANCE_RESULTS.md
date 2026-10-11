# Performance delivery and validation

Recorded October 10, 2026 on Windows with Temurin Java 21.0.12, Intel i5-8265U, Balanced power plan and Microsoft Edge 156.0.4314.15. Baseline source is `ec99bcea449c243d67575e40761f966cd1328d6b`; candidate is the uncommitted working tree delivered with this report. Raw startup files contain distinct artifact SHA-256 values. Fresh process launches use warm filesystem caches, synthetic profile data, no account credentials, and unchanged ports. This is local development-machine evidence, not cold-machine or field validation.

## Outcomes

| Measurement | Baseline | Candidate | Conditions |
| --- | --- | --- | --- |
| Full supervisor fresh launch median | 6.179 s | 2.422 s | Ten fresh launches each; host/backend/proxy/frontend readiness |
| Full supervisor fresh launch p95 | 7.719 s | 4.062 s | Nearest rank; ten samples makes this the maximum |
| Five visible minutes: first-party reads | 334 | 156 | Accelerated browser timers, settled responses, synthetic integrations |
| Five hidden minutes: first-party reads | 322 | 0 | Same harness; hidden state emulated |
| Core commits while Calendar is delayed | Blocked by Calendar | 35-36 ms after resource completion | Calendar held for ten real seconds; controlled browser clock |
| Control pending feedback | Not measured | Within 50 ms | Controlled browser clock, held mock mutation; no radio changed |
| Music iframe across navigation | Previously mounted on startup | Deferred until first Music visit; same DOM node retained afterward | Mock external player; audio itself not tested |

The final fresh-launch median decreased by 60.8% in this environment. Visible read volume decreased by 53.3%. These are separate observations; fewer requests do not alone prove a CPU improvement. User actions and initial load are excluded from polling counts. The control test measures immediate pending feedback, not hardware confirmation.

## Browser CPU investigation

A separate headless Edge experiment observed five real minutes visible and five with hidden state emulated, using synthetic integrations on the same development server. It swaps baseline HEAD `App.jsx` against the current dashboard component while sharing the current Vite server, CSS/assets, dependencies and helper modules. It measured the browser process trees only, without Java/native CPU or memory. Before the final rendering correction, visible CPU time increased from 14.337 to 18.279 seconds despite fewer reads (320 versus 146). The renderer accounted for the increase. Hidden CPU time decreased from 7.937 to 0.546 seconds, with zero candidate reads.

Healthy loading/success status updates were causing additional whole-dashboard React renders. Full status now stays in refs, while error changes update the visible banner and successful data still commits immediately. A 60-second follow-up measured visible CPU time of 1.756 seconds baseline versus 1.326 candidate, and hidden time of 1.562 versus 0.170 seconds. This shorter follow-up is diagnostic evidence; it does not replace the five-minute acceptance scenario. The original regression is retained in [before-fix samples](performance/browser-cpu-before.json), and the shorter result in [follow-up samples](performance/browser-cpu-followup.json).

The final full-duration rerun began after build/startup/package validation finished, with no root builds or service tests during capture. Over five real minutes visible, baseline used 8.118 CPU seconds and candidate 6.439, a 20.7% reduction; reads were 320 versus 146. Over five real minutes hidden, CPU time was 6.566 versus 0.180 seconds, a 97.3% reduction; reads were 320 versus zero. Visible average contribution across eight logical processors was 0.338% versus 0.268%, and hidden 0.274% versus 0.0075%. Both browser instances recorded zero JavaScript errors. [Final CPU samples](performance/browser-cpu.json) retain process IDs, timings, component hashes and workload limitations. These results address the initial visible regression within this component-only comparison.

These browser-only runs use mocked data, headless browsers and emulated visibility. Shared machine load, developer serving and process exits between samples limit interpretation; no total-application CPU or working-set memory improvement is established.

## Java deployment decisions

Ten alternating samples per layout with the same normal Java artifact measured backend readiness medians of 6.595 s (nested JAR), 4.977 s (extracted), and 3.400 s (CDS). Corresponding p95 values were 8.013, 5.584, and 8.234 s: CDS had a slow sample under this development workload. First `/api/system` use and working set are included in the raw files; backend readiness is not the full supervisor milestone above.

Spring JVM AOT was built separately under `backend/target/aot`, and each layout was sampled ten times: medians 5.344 s (JAR), 4.200 s (extracted), 3.108 s (CDS), with p95 9.412, 7.469, 4.194 s. The AOT build predates final small correctness/diagnostic edits, so it remains an experiment rather than the shipping artifact. AOT plus CDS offered about 9% lower median than normal CDS in these separate local samples; account/hardware compatibility is not established. Production uses normal Java, extracted deployment and CDS. No GraalVM or full C++ rewrite was selected after the median startup target was met.

CDS training happens only at build time with isolated empty data. Production checks the trained Java `release` identity, uses `-Xshare:auto`, and falls back when the archive is absent, invalid or incompatible. Tests exercise absent and corrupt archives in a relocated installation. The runtime needs its extracted JAR and `lib/` tree together. Relative data paths still resolve against the installation's backend directory, despite Java's extracted working directory.

## Route and state evidence

Each of eight representative routes was read 100 times directly and 100 times through the native proxy for each build. The [raw CSV](performance/route-samples.csv) includes every sample, payload bytes and port. Warm caches and empty histories make these HTTP observations unsuitable for measuring large-history work; the synthetic Java test isolates that cost. The first request is retained rather than discarded. Some simple route samples regressed noisily; no universal route speedup is claimed.

| Synthetic conversation history | Old whole-state read median | Targeted memory-list read median | Old / new allocated bytes per read |
| --- | --- | --- | --- |
| 20 KiB | 0.7012 ms | 0.0013 ms | 160,854 / 101 |
| 1 MiB | 6.0293 ms | 0.0006 ms | 8,606,612 / 101 |
| 10 MiB | 38.7213 ms | 0.0005 ms | 79,271,948 / 101 |

These are 100 local Java accessor calls per case, not end-to-end HTTP timings. Targeted reads avoid serializing unrelated conversations. Mutable actions/conversations remain defensive copies, and writes persist successfully before publishing cache state. The JSON format remains compatible; no database migration or write debouncing was added.

## Implementation and loose ends corrected

- Dashboard resources commit independently, use one pending read each, cancel/invalidate stale generations, schedule after completion, pause while hidden, and reconcile only affected resources after writes. Invalidation occurs before and after mutations so reads begun during a write cannot overwrite its confirmed result. Failed memory saves preserve the draft; successful saves clear it even when a subsequent list refresh fails. Browser regressions exercise both cases.
- Profile switches stop the old scheduler and reload with captured request identities. Selected conversation and Calendar date changes discard superseded selection work. Profile deletion uses an exclusive lease for every DELETE request, including alternate path spellings accepted by Spring routing.
- Phone metadata is read once, cached by path/size/modification time, bounded to two files and protected against partial writes. Shared native app/process observations have a two-second cache and explicit refresh bypass.
- Media snapshots carry opaque artwork URLs. Metadata is event-driven with 30-second revalidation, artwork sources are limited to four entries of at most 4 MiB each, and raster bytes are encoded only for the image request. The bridge deadline includes queue wait and mutations are never automatically retried.
- Calendar network work runs outside the global cache lock, deduplicates profile/date reads, invalidates disconnected results, bounds profile/date/fetch counts, and validates authenticated CalDAV destinations. Client leases reuse OpenAI clients and retire them safely on key rotation/deletion.
- Static host assets support ETags/304 and immutable hashed filenames. Connection reuse, broad view splitting and image conversion were not selected without measured benefit.
- UI example app activity, invented RAM/OS values and fake elapsed app ages were removed. Missing controls remain unavailable, remaining icon imports were restored, the current date replaces a static date, the header collision was corrected, and width animation was removed after the Impeccable check.
- Relocated package validation exposed an intermittent post-teardown port preflight failure. Listener release now requires three clear observations within the existing five-second cleanup budget, and restart checks release again before replacement. Initial launch still rejects unrelated listeners immediately. The final fresh-launch measurement includes this correction.
- Final backend review corrected configured-key status for corrupt or undecryptable saved credentials, strengthened artwork raster signature validation, and rejected workspace reads/writes through existing junctions that resolve outside the configured root. Workspace read/list tools also exclude configured and conventional data directories plus root `.env`/`.env.*` files through canonical aliases, with `.env.example` readable as a template. Approved writes retain their approval/path policy. Canonical traversal, secret-file exclusion, corrupt credential and raster-header regression tests passed; root confinement still assumes the installation is protected from untrusted concurrent filesystem changes.
- Startup-layout sampling now preserves completed observations separately on failure, keeps per-sample logs and removes isolated data in a `finally` block. An injected process-start failure verified that cleanup without starting Java or changing the running installation.
- All four READMEs were rewritten around their current responsibilities, runtime/source prerequisites, ports, profile/security behavior, cache/refresh limits, commands and troubleshooting. Historical migration/startup documents are marked historical.

## Verification and review scope

Production build: native Release and protocol CTest; backend suite 51 tests, 50 passed and one opt-in benchmark skipped; frontend 23 tests passed; Vite/Sites build passed. The opt-in history benchmark was run separately and passed. Native host suite: 10 passed, covering conditional caching, asset changes, confinement, HTTP framing, proxy headers/redirect behavior and backend failure. Native bridge checks exercised health and read-only integrations without radio changes. Browser tests passed delayed Calendar, commits, visible/hidden scheduling, immediate pending feedback, profile request headers and deferred iframe retention, with zero JavaScript errors. Desktop/mobile screenshots were inspected.

Lifecycle tests cover concurrent/duplicate launch, proxy readiness, CLI/API restart and shutdown, unrelated-listener survival, service/supervisor failure cleanup including bridge descendants, artifact diagnostics and CDS fallback. The final extracted ZIP is validated separately with manifest hashes and a real built-dashboard browser smoke through the native host. Test logs are under `backend/target/`; raw performance evidence is preserved here. No publication, push or merge was performed.

A managed Codex Security diff scan reviewed all 33 changed source inventory items in its initial snapshot and established no reportable security vulnerability. It identified the raw-path deletion race as a correctness defect, which was fixed. The sealed report belongs to its initial snapshot. A final agent static review separately covered later profile leases, workspace/secret-file confinement, usable credential status, raster signatures, mutation invalidation, status rendering, native cleanup and capability changes; no additional reportable issue was established. It also identified the successful-memory-save/failed-refresh correctness edge, which was fixed and browser-tested. This is static review, not a network dependency advisory audit or authenticated exploit test.

## Remaining acceptance checks

Automated implementation and package checks do not close every original gate. The following require dedicated live validation: five real minutes each of visible/hidden total application CPU and memory against the baseline (the separate component-only browser CPU run does not close this gate); real Apple Music/Spotify audio and track/provider changes; corrupt/oversized artwork and cache bounds under active playback; saturated slow-read bridge/control confirmation; real Phone Link metadata refresh; authenticated Calendar/OpenAI key rotation; sleep/resume and multiple Windows users/sessions. No credentials, accounts, network adapter states or real profile data were altered to manufacture these results.

Do not claim these live gates passed or turn this report into release approval. Static source inventory plus targeted tests does not establish absence of every defect across the codebase. The [action plan](PERFORMANCE_ACTION_PLAN.md) records adopted and deferred decisions.

## Reproduce

Use the root/backend/frontend/native README commands. Main performance helpers are `scripts/measure-performance.ps1`, `scripts/compare-startup-layouts.ps1`, the opt-in `StatePerformanceTest`, `frontend/tests/browser-performance.mjs`, `frontend/tests/browser-mutation-races.mjs`, and `frontend/tests/browser-cpu-performance.mjs`. See the preserved [baseline startup](performance/baseline-startup.json), [candidate startup](performance/candidate-startup.json), [normal JVM layouts](performance/jvm-layouts.json), [AOT layouts](performance/aot-layouts.json), [state reads](performance/state-reads.json), [baseline browser](performance/baseline-browser.json), and [candidate browser](performance/candidate-browser.json). Layout runs were separate and host load was not perfectly controlled; full supervisor baseline/candidate uses its distinct artifacts and readiness definition.
