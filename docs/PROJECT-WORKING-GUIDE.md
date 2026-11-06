# Live Desktop Project Working Guide

Version 1.0 | 02 November 2026

Development, design, security, validation, and release procedures.

## Purpose

A practical handoff for anyone working on Live Desktop. The guide consolidates project instructions, current repository contracts, saved project workflow preferences, and the steps required to build, verify, and deliver changes.

## Scope and authority

Read the current repository instructions before each task; source, scripts, and current documentation govern implemented behavior. Saved preferences identify the expected project workflow. Historical validation results are not evidence for a new change.

## Evidence status

This document records operating instructions. Its preparation did not run builds, tests, account checks, hardware checks, or release publication.

## Contents

1. Understand the project before touching it
2. Follow the mandatory README-maintenance rule
3. Use the project's required tools and saved workflow preferences
4. Inspect the checkout and define the work before editing
5. Set up the development environment correctly
6. Run development and production through the intended entry points
7. Preserve the accepted Flight Deck design
8. Apply the visual details consistently
9. Preserve responsive layout and accessibility behavior
10. Never turn missing or illustrative information into product claims
11. Keep frontend state and refresh logic centralized
12. Preserve profile isolation and credential handling
13. Preserve action approval and workspace boundaries
14. Keep integrations within their supported boundaries
15. Preserve backend integration bounds and invalidation behavior
16. Preserve the native runtime's ownership and security model
17. Preserve Sites handoff support
18. Validate the appropriate layers before declaring completion
19. Perform browser regression checks for affected UI behavior
20. Make performance claims only from comparable measurements
21. Separate automated evidence from manual acceptance
22. Package and release only through the verified workflow
23. Troubleshoot using the documented runtime boundaries
24. Use this completion checklist for every change

---

## 1. Understand the project before touching it

Live Desktop is a local Windows dashboard that prioritizes PC state and provides approved controls, conversations, inspectable memories, iCloud Calendar, Phone Link status, and Apple Music/Spotify.

Working directory:

`C:\Users\treyu\Personal Code\Live-Desktop`

Architecture responsibilities:

| Layer | Responsibility |
| --- | --- |
| React/Vite frontend | Presentation, local UI preferences, drafts, navigation, and requests to the local backend |
| Java backend | Profiles, persistence, integration logic, approval policy, OpenAI orchestration, calendar, and parsing local metadata |
| C++ Windows components | Windows execution, native APIs, credential protection support, frontend hosting, and production lifecycle management |

Preserve this separation when implementing changes. Approval and profile policy belong in Java; the native bridge executes constrained Windows operations.

"Local" does not mean every feature works offline. Profiles and application state stay on the PC, while OpenAI, iCloud, and music use external services.

Read these files before substantive work:

| File | What it establishes |
| --- | --- |
| `AGENTS.md` | Project-wide maintenance requirements |
| `frontend/AGENTS.md` | Frontend workflow, visual direction, integrations, and prototype constraints |
| `README.md` | Setup, prerequisites, runtime behavior, configuration, and troubleshooting |
| `PRODUCT.md` | Product purpose, commitments, constraints, and evidence boundaries |
| `DESIGN.md` | Current Flight Deck design contract |
| `backend/README.md` | Backend APIs, persistence, integration lifecycle, and security boundaries |
| `frontend/README.md` | Frontend state, refresh, integration, and build contracts |
| `native/README.md` | Launcher, host, bridge, and credential DLL contracts |
| `docs/VALIDATION.md` | Tests, performance measurement, and manual acceptance limits |
| `docs/PACKAGES.md` | Distribution and publication workflow |

The current source, scripts, and documentation establish implemented behavior. Old plans, generated images, and past successful tests do not prove what the current checkout does.

## 2. Follow the mandatory README-maintenance rule

Treat README maintenance as part of every adjustment. Before finishing any code or configuration change, check whether user setup, prerequisites, environment variables, commands, ports, integrations, security behavior, or troubleshooting steps changed. Update the relevant root/backend/frontend README in the same change whenever they did.

Keep setup documentation aligned with the scripts and the behavior that is actually running. Remove superseded setup paths rather than leaving them as alternatives.

Apply that rule on every code or configuration change:

1. Identify the behavior being changed.
2. Check whether it changes installation or setup.
3. Check whether prerequisites or supported versions changed.
4. Check whether commands, ports, or environment variables changed.
5. Check whether account connections or integrations changed.
6. Check whether approval, credential handling, or another security behavior changed.
7. Check whether existing troubleshooting instructions remain accurate.
8. Update every affected README in the same change.
9. Remove obsolete instructions that the new behavior supersedes.
10. Check that the documented commands agree with the actual scripts.

The native README and focused documentation also need updates when their contracts change. The root rule's reference to root/backend/frontend does not make inaccurate native or validation documentation acceptable.

## 3. Use the project's required tools and saved workflow preferences

| Work | Required or preferred workflow |
| --- | --- |
| Designing or changing interfaces | Use Impeccable and follow its applicable guidance |
| Changing branches or pushing code | Use the GitHub integration |
| Shipping code to main | Use Codex Security / Security Review before shipping |
| Delegated computer/browser actions | Use Computer/Browser when they make the work faster |
| Recovering relevant previous decisions | Retrieve relevant prior conversation/memory context |
| Persisting project memories | Save project decisions/details when explicitly requested |

Read the applicable tool or skill instructions before using that workflow. Do not claim an integration ran merely because a similar manual review was performed.

For security work, distinguish a completed formal scan from a targeted or static review. A historical scan applies to its exact patch snapshot and does not approve later changes.

## 4. Inspect the checkout and define the work before editing

1. Read the applicable instructions listed above.
2. Inspect the current branch, working tree, and remote.
3. Identify existing user changes and preserve them.
4. Determine whether the task affects frontend, backend, native code, packaging, or several layers.
5. Trace the current implementation before designing a replacement.
6. Identify the relevant validation commands.
7. Identify documentation that will need to change.
8. Establish whether the request includes local implementation, branch/push work, or publication.

Useful inspection commands:

```powershell
Set-Location 'C:\Users\treyu\Personal Code\Live-Desktop'
git status --short
git branch --show-current
git remote -v
```

Recheck repository identity and the final target before release work; do not assume those details remain unchanged. Local implementation does not itself authorize publication.

## 5. Set up the development environment correctly

Source builds require:

- Windows with the required native development tooling
- Java 21
- Node.js 20.19+ or 22.12+, as currently documented
- pnpm
- Visual Studio 2022 Build Tools with Desktop development with C++
- CMake
- A Windows SDK containing C++/WinRT
- The included Maven wrapper

From the repository root:

```powershell
.\scripts\bootstrap-java.ps1
pnpm --dir frontend install --frozen-lockfile
.\scripts\build-production.ps1
.\start.cmd
```

The Java bootstrap verifies and installs Temurin under `.tools/jdk-21`.

If PowerShell execution policy blocks the scripts:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

The packaged application has different requirements from a source build. Java-inclusive packages do not require Node, Maven, Visual Studio, CMake, or a separate Visual C++ runtime.

Do not confuse "users can run the package without build tools" with "developers can rebuild it without build tools."

## 6. Run development and production through the intended entry points

For development, use separate terminals:

```powershell
.\scripts\run-backend.ps1
.\scripts\run-frontend.ps1
```

Constraints:

- The backend requires the built native bridge and credential DLL.
- Stop the backend before replacing its loaded DLL.
- The frontend script binds Vite to loopback and strict port 4173.
- The backend normally uses loopback port 4317.
- The frontend proxies `/api` and `/health`.
- Prefer the frontend script for ordinary local development; raw Vite has a broader bind in its configuration.
- Stop development terminals before starting production.
- The production supervisor manages its own children, not arbitrary development processes.
- Rebuild production artifacts after source changes.

For production: `.\start.cmd`

Lifecycle commands, from the installation directory:

```powershell
.\native\build\Release\live-desktop-launcher.exe status
.\native\build\Release\live-desktop-launcher.exe restart
.\native\build\Release\live-desktop-launcher.exe shutdown
```

Production startup must not build, extract, train CDS, or download dependencies. Those tasks belong to preparation/build time.

When implementing UI work, run the local server and open the preview when the environment permits. Do not hand the user server-start instructions when you can perform that work yourself.

## 7. Preserve the accepted Flight Deck design

The current design direction is settled. Refine it in place.

Preserve:

- True-black canvas
- PC overview as the primary emphasis
- Three central PC instruments
- Controls on the left
- Connected services on the right
- Reserved header and bottom dock
- All seven views
- Local profile management
- Frontend/backend restart and shutdown access

The seven views are: Overview, System Info, Conversations, Music, Approvals, Memories, Settings.

The selected V2 reference informed the November 2 refinement. Earlier galleries and light explorations are superseded where they conflict with the current contract.

Current reference guidance is in `docs/redesign/README.md`. `DESIGN.md` is the current contract; source/CSS governs runtime details.

Use the Product Design plugin's `get-context` skill before substantial visual work when the visual source is unclear or no longer fits the goal.

When implementing a newly selected generated mock, treat it as the reference for layout, component anatomy, density, spacing, color, typography, content, and hierarchy. For the existing V2 design, the written contract already resolves differences — for example, retain true black even if the generated image looks near-black.

Record durable prototype-specific design feedback, preferences, or decisions in `frontend/AGENTS.md`.

## 8. Apply the visual details consistently

| Element | Requirement |
| --- | --- |
| Default page background | `#000000` |
| Surface | `#0d1117` |
| Main text | `#f1f4f6` |
| Default accent | `#4a9aff` |
| Main font | Segoe UI Variable, Segoe UI, sans-serif |
| Code and measurements | Consolas/monospace where specified |
| Numerals | Tabular |
| Body text | 14 px |
| Prose/memories | 16 px |
| Titles | 18 px |
| Page titles | 24–30 px |
| Controls/navigation corners | 10 px |
| Containing surfaces/overlays | 14 px |
| Standard interaction targets | At least 44 px high |
| Focus outline | 2 px readable accent with 4 px offset |
| Icons | Explicitly imported Feather outline icons, normally 20 px with 1.75 px stroke |
| Transitions | 150 ms for color/background/border |
| Reduced motion | Disable animations/transitions |

Additional requirements:

- Preserve airy spacing.
- Avoid turning the UI into a dense wall of bordered cards.
- Use spacing and subtle rules to structure text rows.
- Use mint, amber, and rose for ready, pending, and error states alongside text.
- Keep semantic status colors independent of the chosen accent.
- Preserve saved accent choices.
- Derive readable text, focus, and fill foreground colors.
- Render a saved Black accent as white in dark mode and black in light mode.
- Do not add idle gauge animation, glow, or backdrop effects.
- Keep status labels as text without capsule fills.

## 9. Preserve responsive layout and accessibility behavior

Desktop layout:

- Reserve separate rows for header, content, and dock.
- Only content scrolls.
- Maximum content width is 1760px.
- Desktop padding is 28px.
- Overview leads with the three center instruments.
- System Info uses bars and specifications.
- Task-oriented views use ruled layouts.

Below 1200px:

- Services move below controls/instruments.
- Settings becomes one column.

Below 768px:

- Horizontal padding becomes 16px.
- Instruments precede controls and services.
- Workstation artwork is hidden.
- Dock exposes Overview, System Info, Conversations, and More.
- More contains Music, Approvals, Memories, and Settings.
- More includes the pending count.
- Preserve access to all seven view IDs and lifecycle/profile controls.

For short desktop viewports, shrink artwork and gauges appropriately.

Interaction requirements:

- Selected navigation retains `aria-current`.
- More exposes its expanded state and supports Escape.
- Destructive confirmations contain keyboard focus.
- Confirmations allow cancellation and restore focus afterward.
- Fields retain visible labels and errors.
- Preserve drafts, complete action scopes, loading states, stale states, error states, and empty states.
- Shutdown requires confirmation.

## 10. Never turn missing or illustrative information into product claims

### Gauges

- Use a shared 240-degree open-bottom arc.
- Use four-unit, round-ended strokes and a slate track.
- Put labels above, values inside, and details below.
- Accept only finite readings in the 0–100 range for percentage displays/fills.
- Zero means zero active stroke.
- One hundred fills the complete sweep.
- Unavailable readings show a dash.
- Use four-pixel tracks for bars.

### Device imagery and status

- The graphite workstation illustration is generic; do not imply it is a detected computer model.
- Phone imagery follows actual available platform metadata.
- Use iPhone artwork for Apple/iOS metadata.
- Use Android artwork for Android metadata.
- Use a neutral placeholder when platform information is unknown.
- Do not infer provider availability from decorative colors.
- Do not populate production telemetry with generated reference readings.

### Controls

- Distinguish direct Wi-Fi/Bluetooth changes from opening Settings.
- Focus, Night light, Mic privacy, and Battery saver are approved Settings launches.
- Opening Settings does not confirm a toggle changed.
- Label actions that leave Live Desktop and open Windows apps as external.

Do not add voice input, calendar editing, or unsupported playback features under the guise of completing the existing design.

## 11. Keep frontend state and refresh logic centralized

- APIs, profiles, and mutations belong in `App.jsx`.
- Presentation belongs to views and components.
- Refresh coordination belongs to one resource scheduler.

Views own presentation and drafts. They must not start independent polling loops.

Preserve these scheduler behaviors:

1. Commit resources independently.
2. Permit only one in-flight read per resource.
3. Apply a 12-second deadline.
4. Capture profile identity for reads.
5. Abort reads on teardown.
6. Invalidate reads before and after mutations.
7. Prevent stale responses from overwriting confirmed writes.
8. Make manual refresh join existing reads.
9. Keep healthy scheduling bookkeeping in refs.
10. Use visible state for loading, errors/recovery, and freshness.
11. Retain last-known data after failures, with retry behavior.
12. Keep successful empty results empty.
13. Display missing readings as unavailable.
14. Pause routine reads while the document is hidden.
15. Deduplicate refreshes when visibility returns.
16. Stop old-profile reads when switching profiles.

Current documented intervals (measured after completion):

| Resource | Interval |
| --- | --- |
| Media | 5 seconds |
| Phone Link | 10 seconds |
| System | 15 seconds |
| Health/runtime | 30 seconds |
| Apps/actions/memories/conversations/settings | 60 seconds |
| Calendar | 4 minutes |

Preserve submission behavior:

- Failed assistant or memory submissions retain drafts.
- Successful saves clear drafts even if the subsequent list refresh fails.

## 12. Preserve profile isolation and credential handling

The top-bar profile icon opens the local profile picker.

Keep these profile-scoped: identity, appearance, conversations, memories, approvals, API keys, integration configuration, browser preferences.

Backend requests use `X-Profile-Id`.

Storage layout:

- Default profile: directly under `data/`
- Other profiles: `data/profiles/<id>/`

Profiles organize local data. They are not an authentication boundary between Windows users.

Backend contracts include:

- Request context is cleared afterward.
- Profile deletion waits for in-flight profile requests.
- State format remains version 1 unless deliberately migrated.
- Targeted defensive reads avoid loading unrelated history.
- Writes atomically replace disk state before publishing in-memory state.
- Approval persistence is synchronous.

Credential requirements:

- Use current-user Windows DPAPI.
- Return credential availability/status rather than plaintext.
- Never echo iCloud passwords to the frontend.
- Only the default profile uses the OpenAI environment-key fallback.
- Preserve the distinction between protected storage and plaintext held in memory during use.
- Keep the installation directory private to the Windows account.
- Back up `data/` before upgrades.
- Remember that DPAPI-protected credentials are tied to their Windows user.

## 13. Preserve action approval and workspace boundaries

- Assistant reads run immediately.
- File writes, durable memories, browser launches, and device controls require first-use approval for the matching profile and scope.
- Matching approved capabilities may run immediately afterward.

Approval details must explain the reusable scope. Radio approvals include both on and off within that scope. Do not broaden approval silently.

Workspace tools must preserve:

- Canonical path checks
- Rejection of symlink/junction escapes
- Read limits of 100 KB
- Directory listing limits of 500 entries
- Exclusion of configured/conventional profile data directories
- Exclusion of root `.env` variants, except `.env.example`
- Existing approval and path checks for writes

These checks do not lock the filesystem against concurrent replacement. Do not claim they provide stronger isolation than they do.

For ambiguous mutations, refresh or query the current state before retrying. The bridge must not automatically replay a mutation whose outcome is unknown.

## 14. Keep integrations within their supported boundaries

| Integration | Required behavior |
| --- | --- |
| OpenAI | Settings accepts a project API key; protect stored keys with DPAPI; report availability without exposing keys; API billing is separate from ChatGPT |
| iCloud Calendar | Use Apple email and an app-specific password; keep credentials protected; provide read-only agenda, date selection, refresh, and expansion within Overview |
| Apple Music/Spotify | Profile-scoped provider selection; separate retained links; one persistent selected-provider embed; Windows media sessions supply real metadata and supported commands |
| Phone Link | Use available local metadata; refresh automatically and on demand; reflect known platform accurately; label opening Phone Link as external |
| Windows controls | Use direct radio changes only where supported; use explicit Settings routes for unsupported direct controls |

Music-specific rules:

- Do not require Apple Developer Program enrollment.
- Do not request MusicKit credentials, Team ID, Key ID, or `.p8` keys.
- Do not require a Spotify OAuth client or developer application.
- Mount the embed on the first Music visit.
- Preserve it across navigation.
- Replace it when changing providers.
- Retain each provider's separate content link.
- Preserve the compact custom player presentation.
- Do not promise playback or metadata that the Windows session/provider does not expose.

Additional dashboard integrations must not introduce an extra paid developer program or paid API requirement. Prefer local Windows capabilities and services the user already owns.

## 15. Preserve backend integration bounds and invalidation behavior

When changing integration internals, consult the backend README rather than replacing bounded behavior with unbounded caches or network work.

| Area | Contract |
| --- | --- |
| Bridge | One lazy peer with owning-PID checks; serialized 15-second budget including queue wait |
| Queued reads | Expired reads must not be dispatched |
| Static system specifications | Cached for backend lifetime |
| Battery | 5-minute cache |
| Radio state | 30-second cache |
| Native process/package snapshots | 2-second cache |
| Phone metadata JSON | 1 MiB/file cap; size/mtime caching up to 30 seconds; reject partial/replaced reads |
| Calendar | Up to 32 profiles, 8 cached/pending dates per profile, 4 active fetches |
| Calendar cache | 4-minute date cache and 30-minute discovery cache |
| Calendar refresh/error retry | 15-second budget/cache behavior |
| OpenAI clients | Up to 16 clients keyed by profile/key fingerprint |
| Artwork | Four native entries, each up to 4 MiB |

Additional constraints:

- Explicit Phone Link refresh bypasses relevant caches.
- Calendar network work must avoid the global cache lock.
- Calendar reconnect, disconnect, and removal invalidate pending results.
- Stale calendar events may remain only for the same date.
- Validate Apple-owned HTTPS destinations and redirects before sending credentials.
- Retire rotated/removed/evicted OpenAI clients after active leases finish.
- Keep tool rounds bounded.
- Do not assume streaming exists.
- Artwork uses opaque versions rather than exposed filesystem paths.
- Validate PNG/JPEG/GIF/WebP signatures.
- Use private artwork caching and nosniff.
- Snapshots contain artwork references rather than Base64 payloads.
- Local API access stays on `LocalAccessFilter`, ahead of profile handling. Each launch issues a token on `GET /health`; every other route requires `X-Live-Desktop-Token`. `Host` must be `127.0.0.1` or `localhost` on the accepting port. A present `Origin` must be `http://127.0.0.1` or `http://localhost` on port 4173 or the backend port. Every `POST` and `DELETE` requires `Content-Type: application/json`. The filter reads `Host` and `Origin` directly.

## 16. Preserve the native runtime's ownership and security model

The native build produces four x64 artifacts: launcher, frontend host, Windows bridge, and JNI credential DLL.

```powershell
.\scripts\build-windows-bridge.ps1
.\scripts\test-windows-bridge.ps1
.\scripts\test-native-host.ps1
```

Runtime requirements:

- Deduplicate starts using the current-user workspace mutex.
- Put suspended children into a Windows Job Object before execution.
- Clean up owned descendants when the supervisor or a service fails.
- Never infer process ownership from a name, occupied port, or saved PID.
- Reject unrelated listeners without terminating them.
- Treat TIME_WAIT separately from active listeners.
- Preserve host/Origin checks and path confinement.
- Preserve framing limits, body limits, and header filtering.
- Keep immutable caching limited to appropriate hashed assets.
- Do not treat API responses as shared immutable assets.

Bridge requirements:

- Random named pipe created by Java
- Current-user ACLs
- Remote-client rejection
- Connected-PID verification
- Exit when the backend dies
- Reset broken peers without replaying mutations
- Protocol v1 with request IDs, allowlisted operations, and object arguments
- 16 KiB request limit and 8 MiB response limit

Do not add arbitrary shell execution, arbitrary registry/file-path operations, or arbitrary process-kill capabilities to the bridge.

The credential DLL uses current-user DPAPI through JNI. Preserve restricted DLL loading from the installation's Release directory and cleanup of native buffers/temporary byte arrays.

## 17. Preserve Sites handoff support

Keep these files intact:

- `frontend/.openai/hosting.json`
- `frontend/worker/index.js`
- `frontend/scripts/prepare-sites-build.mjs`
- `frontend/tests/sites-worker.test.mjs`

Build the app UI under `frontend/src/`.

Before a Sites handoff:

```powershell
npm --prefix frontend run build
npm --prefix frontend run test:sites
```

The build must leave:

- `frontend/dist/client/index.html`
- `frontend/dist/server/index.js`
- `frontend/dist/.openai/hosting.json`

A hosted preview requires its own backend integration for local Windows capabilities. Publishing a frontend preview does not prove that Windows controls or local integrations function remotely.

## 18. Validate the appropriate layers before declaring completion

```powershell
.\scripts\build-production.ps1
.\scripts\test-windows-bridge.ps1
.\scripts\test-native-host.ps1
.\scripts\test-production-startup.ps1
npm --prefix frontend run test:sites
```

Before running lifecycle validation:

- Stop production and development instances.
- Free ports 4173 and 4317.
- Do not terminate unrelated processes merely because they occupy those ports.
- Ensure development Node/Playwright and Microsoft Edge are available for the lifecycle/browser tests.

The production build runs native CTest protocol checks, backend tests, frontend unit tests, Vite/Sites asset build, backend runtime extraction, and build-time CDS training.

Focused Java testing:

```powershell
$env:JAVA_HOME = (Resolve-Path '.tools\jdk-21').Path
.\mvnw.cmd -pl backend test --no-transfer-progress
```

Report skips separately from passes:

- Live pipe tests may skip if the bridge is absent.
- Credential compatibility needs the DLL.
- `StatePerformanceTest` is opt-in.

Readiness validation checks: native `/_live/ready`, direct backend `/health`, proxied `/health`, dashboard `/`.

Full startup readiness and completion of every integration's loading are different conditions.

## 19. Perform browser regression checks for affected UI behavior

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 4174 --strictPort
npm --prefix frontend run test:browser
node frontend/tests/browser-mutation-races.mjs
node frontend/tests/browser-redesign.mjs
```

Coverage includes independent resource commits during delayed calendar loading, request budgets, hidden-document polling, profile headers, deferred/persistent music iframe behavior, mutation race protection, draft preservation/clearing, all seven views, viewport widths 1920/1440/1280/768/390/320 px, overflow and dock behavior, approval scope and literal content, keyboard focus, saved appearance, and loading/zero/stale/retry/agenda/phone states.

Evidence limits:

- Browser integrations are mocked.
- Hidden state is emulated.
- Polling windows use accelerated timers.
- The 640×360 viewport approximates space at 200% zoom; it does not test actual browser zoom.
- Screenshots contain synthetic readings/accounts.

Store generated validation screenshots, logs, and measurements under ignored `backend/target/`, as validation documentation directs.

## 20. Make performance claims only from comparable measurements

Keep these separate: dashboard responsiveness, backend route latency, backend health readiness, full dashboard readiness, first system-data use, fresh-process startup, reused startup, cold-machine startup.

Startup metrics contain cumulative milestones. Do not add cumulative stages together.

Diagnostics:

- Browser `?diagnostics=1`, with bounded samples through `window.liveDesktopTimings()`
- `LIVE_DESKTOP_DIAGNOSTICS=1`, with bounded backend timing records
- Root `.startup-metrics.jsonl`

```powershell
.\scripts\measure-performance.ps1 -Label candidate -Launches 10
.\scripts\compare-startup-layouts.ps1 -Pairs 10
.\mvnw.cmd -pl backend '-Dlive.desktop.benchmarks=true' '-Dtest=StatePerformanceTest' test
```

Compare identical workloads and artifacts. Distinguish browser CPU from total Java/native/browser CPU and memory. Fresh processes with warm filesystem caches are not cold-machine measurements. Old measurements are not current performance guarantees.

AOT-related paths are optional experiments. Rebuild normal production artifacts before ordinary production use after such experiments.

## 21. Separate automated evidence from manual acceptance

Automated checks do not establish authenticated OpenAI behavior or key rotation, real iCloud reconnect/recurrence, real Apple Music/Spotify audio, actual provider transitions, Phone Link/device availability, physical radio changes, sleep/resume behavior, isolation between independent Windows users, screen-reader behavior, or actual browser zoom.

Test those with the appropriate accounts, devices, and environment before claiming them.

A truthful completion report identifies what was inspected in source, compiled, unit tested, exercised through mocked browser tests, exercised through the real runtime, validated from the packaged artifact, manually verified with real accounts or hardware, and published/verified after publication.

## 22. Package and release only through the verified workflow

Release work requires explicit release authorization. Existing authorization should be carried through without repeatedly asking for the same permission.

Before publication:

1. Confirm the intended version.
2. Confirm repository identity.
3. Confirm the branch and expected working-tree state.
4. Confirm the final commit that will be tagged.
5. Complete the required validation.
6. Complete the required security review for the exact change.
7. Resolve material failures or unresolved target/version questions.
8. Build and validate the exact artifact intended for distribution.

```powershell
.\scripts\build-production.ps1
.\scripts\package-production.ps1 -SkipBuild -IncludeJavaRuntime
.\scripts\test-production-startup.ps1 -PackagePath .\dist\Live-Desktop-windows-x64.zip
```

`-SkipBuild` reuses artifacts and runs no tests. Use it only after the appropriate build.

```powershell
$releaseHash = (
    Get-FileHash .\dist\Live-Desktop-windows-x64.zip -Algorithm SHA256
).Hash.ToLowerInvariant()
"$releaseHash  Live-Desktop-windows-x64.zip" |
    Set-Content .\dist\Live-Desktop-windows-x64.zip.sha256 -Encoding ascii
```

The package must include required native components, extracted backend deployment, frontend assets, documentation, `.env.example`, and hash manifest. Java-inclusive packages must contain Java 21.

It must exclude saved user data, credentials, real `.env` files, logs, dependency caches, and `node_modules`.

Package validation covers manifest hashes, relocated startup, real-dashboard smoke, duplicate/concurrent launch, lifecycle operations, owned-child cleanup, unrelated-listener survival, missing artifacts, and CDS fallback. Creating a ZIP is not itself a validation result.

For publication: verify the final merged main tag; upload the exact ZIP and checksum; verify the exact bytes published; treat package versions as immutable; never expose registry credentials or signed download URLs; do not assume an installed GitHub CLI is authenticated; report the actual security-review status.

The package workflow uses `com.localassistant:live-desktop-windows-x64:<version>:zip`. It is an application distribution ZIP, not a Java library dependency.

The documented GitHub workflow publishes already attached release bytes after checksum verification; it does not rebuild or test the application. Attach the ZIP and checksum before relying on that workflow.

## 23. Troubleshoot using the documented runtime boundaries

| Problem | Correct investigation |
| --- | --- |
| Occupied port | Identify the known development instance or unrelated listener; do not kill arbitrary processes |
| Missing or locked artifact | Stop owned services, then rebuild or extract the complete package |
| CDS/JDK mismatch | Normal extracted Java remains usable; rebuild for a matching archive |
| Unknown mutation outcome | Query current state before retrying |
| Integration unavailable | Verify account/device setup and available metadata |
| Corrupt/unavailable credentials | Report unavailable and reconnect/re-enter credentials as appropriate |
| Startup failure | Inspect launcher and backend/frontend logs |
| Lifecycle failure | Inspect `data/runtime-control.log` |

Relevant root logs: `.launcher.log`, `.backend-preview.out.log`, `.backend-preview.err.log`, `.frontend-preview.out.log`, `.frontend-preview.err.log`, `.startup-metrics.jsonl`.

Stop the application before replacing runtime files. Extract the complete installation folder. Keep it writable and private to the user.

## 24. Use this completion checklist for every change

Before handing work back:

- Confirm the requested behavior is implemented.
- Confirm unrelated user changes were preserved.
- Confirm the accepted Flight Deck direction remains intact.
- Confirm all affected views and navigation remain accessible.
- Confirm profile boundaries are preserved.
- Confirm no unsupported capability is presented as working.
- Confirm missing readings are not converted into zero or healthy states.
- Confirm mutation and stale-response guards remain intact.
- Confirm approval scopes remain explicit.
- Confirm credentials are not exposed.
- Update all affected documentation.
- Remove superseded setup instructions.
- Run the appropriate checks and report skips/failures accurately.
- Inspect the final diff, including documentation.
- Separate local implementation from publication status.
- State any remaining manual account/hardware validation.
- For a release, verify the final tag, published assets, and published-byte checksum.

The final handoff should explain what changed, why it changed, what was tested, and what remains unverified. A person following this guide should always be able to trace a claimed behavior to current source, a documented contract, or a specific validation result.
