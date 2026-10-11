# Frontend

React 19/Vite 6 presents Live Desktop's true-black dashboard, System Info, Music, conversations, memories, approvals, account settings, and local profile picker. The browser calls the backend; it does not inspect Windows directly. See the [root README](../README.md) for installation, accounts, approval semantics, and troubleshooting.

## Develop and build

From the repository root, with Node.js 20+ and pnpm installed:

```powershell
pnpm --dir frontend install --frozen-lockfile
.\scripts\run-frontend.ps1
```

The script can use Codex desktop's bundled Node/pnpm. Vite binds to loopback port 4173 with strict port selection and proxies `/api` and `/health` to backend 4317. Start the backend separately with `scripts/run-backend.ps1`. Stop development terminals before using the production supervisor.

```powershell
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:sites
```

Production serves `dist/client/` using the native C++ host; it needs no Node, pnpm, or Vite runtime. The build also preserves Sites outputs `dist/server/index.js` and `dist/.openai/hosting.json`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and Sites tests in sync. A hosted Sites preview cannot access this PC's backend without its own suitable integration; local Windows features need the local application.

`VITE_API_BASE` is a build/development override; the normal application uses same-origin routes. Build complete production assets through the root build script after changing code.

## Refresh and loading behavior

`resourceScheduler.js` owns dashboard reads. Each successful result commits immediately; Calendar, Phone Link, and media readiness do not block local content. Each resource has loading/error/stale status and one in-flight read. Reads use a 12-second deadline, captured profile identity, abort on teardown, and generation checks after invalidation. Manual refresh joins an existing read; mutation paths invalidate affected reads before the write and again after completion, before applying newer state. Healthy status updates stay in refs to avoid additional dashboard renders; error changes update the visible refresh banner.

Polling is scheduled after completion, preventing overlapping intervals:

| Resource | Visible interval |
| --- | --- |
| Windows media | 5 seconds |
| Phone Link | 10 seconds |
| System data | 15 seconds |
| Health and runtime | 30 seconds |
| Apps, actions, memories, conversations, settings | 60 seconds |
| Calendar | 4 minutes |

Hidden documents pause routine polling. Returning to visibility triggers one deduplicated refresh per resource. This pauses metadata work, not mounted playback. Mutations refresh affected lists immediately; slower reconciliation detects changes from another window. Failures preserve useful last-known data and show a refresh status. Initial system controls are unavailable until live information arrives.

Profiles use browser storage namespaced by local profile ID for theme, accent, avatars, music provider and links. Profile switching reloads the page after stopping old reads. Backend keys and state use the profile header. The Black accent uses white in dark mode for contrast. The profile picker is local organization, not account authentication.

## Music and integrations

The custom player uses Windows media-session data and opaque artwork URLs. Apple Music and Spotify links remain separate per profile. The selected web embed loads on the first visit to Music; once mounted it persists across view navigation. Switching provider intentionally replaces the selected embed. Neither provider requires developer credentials. Provider login, subscription, autoplay, and media-session publication remain external constraints.

Phone Link uses live metadata and platform-matched artwork, with a neutral unknown state. Opening Windows apps is labeled external. iCloud credentials are entered only in Settings and sent to the local backend; no password is returned. Wi-Fi/Bluetooth actions apply confirmed state immediately; unsupported toggles open approved Settings shortcuts.

Only explicitly used Feather icons are imported, allowing the build to remove the rest of the icon library. Large optional views and image conversion remain profiling decisions; current images are unchanged.

## Browser validation and diagnostics

For the performance regression harness, start a separate test server from the root:

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 4174 --strictPort
npm --prefix frontend run test:browser
```

The harness uses Playwright with installed Microsoft Edge, mocks backend integrations, holds Calendar for a real ten seconds, and checks independent rendering, visible/hidden polling, control pending feedback, profile request headers, and deferred music iframe continuity. Five-minute polling windows use accelerated browser timers. It records browser version/results and desktop/mobile screenshots under `backend/target/performance/`. From `frontend/`, `node tests/browser-performance.mjs --baseline` compiles the Git HEAD baseline for comparison.

Helper tests cover scheduling/deduplication/invalidation; the browser test establishes rendering behavior. Synthetic tests do not prove real audio, authenticated accounts, or hardware changes. See the [performance report](../docs/PERFORMANCE_RESULTS.md).

With that server running, `node frontend/tests/browser-mutation-races.mjs` checks that a read started during a mutation cannot overwrite the confirmed result. It also verifies that a failed memory save preserves the draft, while a successful save clears it even if the subsequent list refresh fails.

With the same server running, `node frontend/tests/browser-cpu-performance.mjs` observes five real minutes visible and five with hidden state emulated. It compares independent baseline/candidate headless Edge process CPU times and records them under `backend/target/performance/browser-cpu.json`; it does not sample working-set memory. This synthetic browser-only experiment excludes Java/native CPU, actual background-window throttling, authenticated integrations and playback; it does not close the full application CPU acceptance gate. Shared development-machine load and processes that exit between samples also limit the comparison.

Open the dashboard with `?diagnostics=1` to collect up to 1,000 request/commit timing samples. `window.liveDesktopTimings()` returns copies. Sampling records resource names/times only, with no query values or response content. Normal operation does not collect these browser diagnostics.

The production lifecycle suite also runs `tests/runtime-smoke.mjs` against the built dashboard, native host and real backend in an isolated installation. It requires Playwright dependencies and installed Microsoft Edge on the development machine; these are test dependencies, not runtime package requirements.
