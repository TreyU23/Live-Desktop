# Validation and performance

Run commands from the repository root. Tests cover current behavior; generated screenshots, logs and measurements belong under ignored `backend/target/`, not in documentation. These instructions replace completed migration/design plans and historical session reports.

## Automated checks

```powershell
.\scripts\build-production.ps1
.\scripts\test-windows-bridge.ps1
.\scripts\test-native-host.ps1
.\scripts\test-production-startup.ps1
npm --prefix frontend run test:sites
```

Stop production/development first and free ports 4173/4317. The build runs CTest protocol checks, backend tests, frontend unit tests and the Vite/Sites build; it also extracts Java and trains CDS. The additional scripts cover read-only native integration, host HTTP/security/cache behavior and isolated real-runtime lifecycle tests. Lifecycle tests need development Node/Playwright plus installed Microsoft Edge; package users do not.

For focused Java checks:

```powershell
$env:JAVA_HOME = (Resolve-Path '.tools\jdk-21').Path
.\mvnw.cmd -pl backend test --no-transfer-progress
```

Live pipe tests can skip when the bridge is absent; credential compatibility needs the DLL. `StatePerformanceTest` is intentionally opt-in. Report skips separately from passes.

## Browser regressions

Build, then serve the build on a separate loopback port in one terminal. Serving the build (not the dev server) matters: only the build carries the Content Security Policy that `browser-redesign.mjs` checks.

```powershell
npm --prefix frontend run build
npm --prefix frontend run preview -- --host 127.0.0.1 --port 4174 --strictPort
```

Then, from the root:

```powershell
npm --prefix frontend run test:browser
node frontend/tests/browser-mutation-races.mjs
node frontend/tests/browser-redesign.mjs
npm --prefix frontend run test:contrast
npm --prefix frontend run test:privacy
pnpm --dir frontend exec astryx doctor --built dist/client
```

Playwright uses Microsoft Edge; `BROWSER_TEST_BASE_URL` selects another test server and `PLAYWRIGHT_EXECUTABLE_PATH` another installed browser. Tests mock integrations:

| Suite | Coverage |
| --- | --- |
| `browser-performance.mjs` | Ten-second Calendar delay, independent commits, request budgets, hidden polling, pending feedback, profile headers, deferred/persistent music iframe and an Overview scroll frame budget (median < 16.7 ms, p95 < 25 ms at 1440×900, real timers on a fresh page) |
| `browser-mutation-races.mjs` | Reads during writes cannot overwrite confirmed results; failed memory saves preserve drafts; successful saves clear drafts despite refresh failure |
| `browser-redesign.mjs` | Seven views at 1920/1440/1280/768/390/320 px; overflow and side-navigation/drawer placement, Approvals expandable rows (reusable scope, literal content), approval dialog (opens only for new requests, focus contained, Escape returns focus to the composer, Don’t Allow/Allow write through, no one-shot promise, literal content), drafts, keyboard focus, saved appearance and accent presets (including hex migration), no Reduce transparency, loading/zero/stale/retry, calendar and phone panels, and no Content Security Policy violations |
| `browser-contrast.mjs` | Live theme tokens resolved in the browser, light and dark, all five accent presets: 4.5:1 for text pairs, 3:1 for instrument severity colors and the accent |
| `browser-privacy.mjs` | Device/Product IDs hidden until **Show IDs** on both System Info tabs; the iCloud app-specific password is masked, sent once to the backend and never echoed into the page, a field or browser storage |
| `runtime-smoke.mjs` | Built UI through real native host/backend; invoked by lifecycle tests |

Frontend unit tests (`npm --prefix frontend run test`) include `accent-colors.test.mjs`, which checks that every accent preset is a registered theme and that hex accents saved by the glass UI migrate to the nearest preset. Token contrast moved to `browser-contrast.mjs` because Astryx tokens are `light-dark()`/`oklch()` values that only a browser resolves.

Polling windows use accelerated timers and hidden state is emulated. The frame budget is measured in whatever browser runs the suite; headless software rendering is a stricter case than a GPU-backed Edge window. The 640x360 viewport approximates 200% of 1280x720; it does not test actual browser zoom. Screenshots contain synthetic readings/accounts.

## Packaging

After a successful production build:

```powershell
.\scripts\package-production.ps1 -SkipBuild -IncludeJavaRuntime
.\scripts\test-production-startup.ps1 -PackagePath .\dist\Live-Desktop-windows-x64.zip
```

Package validation verifies manifest hashes, relocated startup, real-dashboard smoke, duplicate/concurrent launch, CLI/API restart/shutdown, owned descendant cleanup, unrelated-listener survival, missing artifacts and CDS fallback. ZIP creation itself is not a test. [Publication](PACKAGES.md) is separate.

## Diagnostics and measurement

- Browser `?diagnostics=1`: at most 1,000 request/commit samples via `window.liveDesktopTimings()`, without query values/content.
- Launch environment `LIVE_DESKTOP_DIAGNOSTICS=1`: at most 1,000 backend route-family/status/duration records, without identities, messages, events or credentials.
- Root `.startup-metrics.jsonl`: cumulative supervisor milestones and launch/reuse semantics. Backend health, full dashboard readiness and first system use are distinct measurements.

With production built, local JDK installed and ports free:

```powershell
.\scripts\measure-performance.ps1 -Label candidate -Launches 10
.\scripts\compare-startup-layouts.ps1 -Pairs 10
.\mvnw.cmd -pl backend '-Dlive.desktop.benchmarks=true' '-Dtest=StatePerformanceTest' test
```

The first helper stages an isolated runtime and records artifact hashes, fresh launches and direct/proxy route samples. The second alternates JAR/extracted/CDS layouts, records first system use/working set, and preserves partial results/logs on failure. The benchmark compares targeted reads with whole-state reads for 20 KiB/1 MiB/10 MiB histories. Output goes under `backend/target/performance/`.

Production uses normal Java with extracted deployment/CDS. The `startup-aot` Maven profile and comparison helper's `-Aot -BuildDirectory backend/target/aot` are optional experiments; build/package and prepare that directory separately before comparison, then rebuild normal artifacts before production use. Fresh process samples with warm filesystem caches are not cold-machine results. Compare identical workloads/artifacts and distinguish browser CPU from total Java/native/browser CPU and memory. Old measurements are not current performance guarantees.

## Manual acceptance

An axe-core scan of all seven views in light and dark at 1440 and 390 px reported no violations on 2026-11-15 after the Astryx redesign (run against the build in Chrome with CSP bypassed only for injecting axe); it is not part of the committed suites, so rerun it after visual changes. The redesign has not yet been checked in Edge on the target PC. Automated checks do not establish authenticated OpenAI/Anthropic behavior or key rotation, iCloud reconnect/recurrence, real Apple Music/Spotify audio/provider transitions, Phone Link/device availability, physical radio changes, sleep/resume, independent Windows-user isolation, screen-reader behavior or actual UI zoom. Validate those with suitable accounts/devices before claiming success. A security scan applies to its exact patch snapshot; historical scans do not approve later changes. Shipping/publishing remains a separate decision.
