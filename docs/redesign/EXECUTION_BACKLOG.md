# Flight Deck implementation backlog

**Updated:** November 1, 2026. **State:** local Flight Deck implementation delivered; release validation remains open. See [implementation evidence](implementation-validation/README.md).

This is the executable companion to [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). The [concept gallery](concepts.html) provides visual references; its static sample data, inert controls, concept selector, review notes, and standalone preview server must never become application features. The October 15 [validation record](VALIDATION.md) applies only to the concept artifact.

## Current delivery status

| Packages | Status |
| --- | --- |
| FD-01 | Pinned baseline/screenshots/tests recorded; branch creation blocked by read-only `.git`. |
| FD-02–13 | Implemented in the local working tree with unit, browser and design-review evidence. |
| FD-14 | Automated viewport/keyboard/contrast/reduced-motion checks pass; actual browser zoom and screen-reader verification remain open. |
| FD-15 | Unit/build/Sites, mutation and performance browser checks pass; baseline/candidate polling compared. |
| FD-16 | Native build/host, backend package and exact extracted-distribution lifecycle checks pass. Authenticated account/device checks remain open. |
| FD-17 | READMEs and design references updated; formal security scan unavailable; draft PR blocked with branch creation. |
| FD-18 | Not authorized; no publication. |

Unchecked packages retain an outstanding acceptance gate; they do not mean the interface is still a proposal.

## 1. Intended result and scope

Deliver the entire Live Desktop dashboard in the Flight Deck visual language, with PC information first, all seven existing views, functioning supporting panels, reachable navigation, light/dark and saved-accent parity, and truthful loading/action feedback. Preserve Java approval/persistence responsibilities and the native Windows execution/runtime path.

Included presentation improvements: readable approval details, pending/history filtering, memory category filtering over already-fetched data, an expanded read-only day agenda, better profile/confirmation focus behavior, per-resource freshness, and contrast-safe accent foregrounds. These presentation changes are implemented; remaining acceptance gates are listed above.

Excluded: replacing React/Java/C++, routing or state-library migrations, changing approval-key semantics, cloud profiles, new notification/message access, voice input, calendar editing, new telemetry collection, media queue/equalizer/seek features, startup optimization, or publication before release authorization. A limitation discovered during implementation should produce a truthful fallback or a narrowly described scope change, not a silently invented capability.

## 2. Original source baseline and invariants

Rechecked at HEAD `5d7539f`. Most screen components and handlers remain in `frontend/src/App.jsx`; styles are in `frontend/src/styles.css`. The source inspection did not execute tests or interact with live accounts.

| Invariant | Required preservation |
| --- | --- |
| View identity | Keep `home`, `system`, `music`, `approvals`, `memories`, `conversations`, `settings`; display Home as Overview if desired |
| Async ownership | One existing `createResourceScheduler` instance for the profile; extracted views do not start independent fetch/poll loops |
| Read lifecycle | One in-flight read per resource, 12-second deadline, generation checks, abort on teardown, completion-based scheduling |
| Polling | Media 5 s; phone 10 s; system 15 s; health/runtime 30 s; apps/actions/memories/conversations/settings 60 s; calendar 240 s; selected conversation on demand |
| Visibility | Hidden documents stop routine reads; returning triggers deduplicated reads; media iframe can remain mounted |
| Mutation safety | Invalidate affected reads before and after mutations, apply confirmed state, do not replay ambiguous writes |
| Profiles | `X-Profile-Id`, existing storage keys, stop old scheduler and reload on switch; no previous-profile content flashes |
| Credentials | API key and iCloud app password remain write-only after save; retain current DPAPI boundary |
| Music | First Music visit mounts selected iframe; keep the same instance through navigation; replace on provider/link change |
| Controls | Direct Wi-Fi/Bluetooth operations versus explicitly external Windows Settings actions |
| Runtime | Header controls manage owned Live Desktop services, not Windows or unrelated processes; readiness-based reconnect |
| Production | Same native host/JAR layout, loopback ports 4173/4317, proxy paths, and Sites build outputs |

**Baseline gaps addressed by this implementation:** `resourceStatus` publishes error changes only, while healthy statuses live in a ref; fallback resource values include zeroes before real data arrives; `AssistantBar` clears its draft immediately and its voice button has no handler; `accentForegroundColor` currently chooses white for nearly every non-white accent. Do not mistake these for already-satisfied requirements.

## 3. Concrete layout and component decisions

### Shell

Use a `100dvh` grid with header, `minmax(0, 1fr)` scrollable view, and a reserved navigation row. No fixed dock overlaying content. Keep modal layers outside the scrolling view. Header overflow wraps without hiding restart, shutdown, Settings, or profile access. Respect safe-area insets and ensure the on-screen keyboard does not cover the focused composer or confirmation action.

Desktop navigation contains all seven labeled destinations; narrow navigation contains Overview, System, Conversations, and More. More opens an accessible disclosure/sheet, exposes the remaining four destinations, and carries the Approvals badge. Selecting a destination closes the disclosure and moves focus to the new view heading. No URL/history routing change is required.

| Width | Overview / view composition |
| --- | --- |
| 1200 px and above | Controls / instruments / services; align using CSS grid; center values outrank schematic |
| 768–1199 px | Controls plus instruments, services below; keep all destinations directly available if they fit |
| Below 768 px | Instruments, controls, then services; four-item navigation; threads and secondary details use accessible disclosures |
| Short viewport (720 px class) | Reduce or hide schematic and decorative space, allow view scrolling, keep navigation and runtime controls reachable |

Breakpoints are implementation starting points, not reasons to tolerate overflow between test widths. Text and hit targets take priority over preserving a screenshot's exact proportions.

### Planned source organization

```text
frontend/src/
  App.jsx                          # existing API, state and mutation ownership initially
  components/
    shell/                         # AppShell, Header, NavigationDock, MoreNavigation
    ui/                            # Icon, Button, FormField, StatusLabel, ConfirmDialog
    instruments/                   # ResourceGauge, ResourceBar, ResourceValue
    feedback/                      # ResourceBoundary, RefreshSummary, ActionNotice
    dashboard/                     # SystemControls, SystemOverview, RecentApps,
                                   # CalendarPanel, PhonePanel, CompactPlayer, AssistantComposer
    profiles/                      # ProfilePanel, ProfileDeleteDialog
    media/                         # PersistentMusicEmbed
  views/                           # Home, SystemInfo, Music, Approvals, Memories,
                                   # Conversations, Settings
  presentation/
    actionDetails.js               # descriptions only, not approval authorization
    resourceViewState.js            # ready/loading/stale/error/unavailable derivation
    formatters.js                  # pure existing formatters extracted as needed
  styles/
    tokens.css
    shell.css
    components.css
    views.css
  styles.css                       # stylesheet entry; old rules removed as migrated
```

Do not split every small label into a component. Extract at meaningful behavior/reuse boundaries. Keep existing `resourceScheduler.js`, `systemControls.js`, `musicProviders.js`, `phoneDevice.js`, `accentColors.js`, and diagnostics rather than duplicating them.

### Data-to-view contract

Presentational modules receive `data`, derived resource state, and existing callbacks. They may own expansion, selection, and form-draft state. They do not own profile identity, polling, or integration mutations. Pending mutation state is separate from resource refresh state; a background refresh must not disable an unrelated form or clear a draft.

Expose resource status through one bounded adapter at the existing scheduler callback. Track first successful completion, current error, manual refresh, and last successful wall-clock time. Publish the first ready transition, meaningful error/recovery changes, and manual action transitions; do not publish every healthy background request start into React state. Data commits already cause relevant renders. Keep the last success timestamp in the same resource store/ref and derive visible freshness on those renders or when a panel opens. Do not add a per-widget second-by-second timer.

`readyAt` in the scheduler is a performance-clock value used by diagnostics: it is not a calendar timestamp. Keep it for timing and record a separate `lastSuccessAt` if displaying a date/time. Clear status alongside data on profile teardown. Treat successful empty arrays as ready/empty, not as lack of a successful read.

| State | Display | Interaction |
| --- | --- | --- |
| Never loaded | Stable frame, dash/skeleton, “Waiting for system data” | Dependent controls disabled; other modules usable |
| Ready | Real values, units, current availability | Supported operations available |
| Refreshing with prior data | Prior values; subtle manual-refresh progress when requested | Do not blank the panel or block unrelated actions |
| Read failed with prior data | Last-known values and failure/last-update label | Resource-specific retry joins scheduler read |
| Read failed without data | Error explanation and retry | No healthy state or fabricated zero |
| Successful empty result | Relevant empty copy | Offer correct next action; distinguish from disconnected |
| Field unavailable | Dash plus explanation; no gauge fill | Do not infer AC power from missing battery alone |
| Mutation pending | Last confirmed state plus “Submitting…” | Disable repeated submission for that target |
| Mutation failed | Error with refreshed actual state | No automatic repeat of the write |

## 4. Work packages

Each checkbox is a delivery unit. An implementer completes code, relevant checks, screenshots, and documentation together. Review the completed unit against its exit criteria. “Depends on” identifies technical ordering; it is not an instruction to create additional agents or chats.

### [ ] FD-01 — Baseline and final design references

**Depends on:** implementation authorization. **Size:** M. **Targets:** root `PRODUCT.md`, proposed `DESIGN.md`, `.impeccable/design.json`, `frontend/AGENTS.md`, `docs/redesign/`.

- Preserve the current working-tree concept artifacts and README changes; create a `codex/flight-deck-redesign` branch from the verified current branch without discarding unrelated work.
- Capture baseline Home/System/Music/Approvals/Memories/Conversations/Settings using synthetic non-secret data. Record commit, viewport, provider/profile fixture, and tool versions. Establish a fixed baseline commit rather than relying on a moving HEAD later.
- Refine Home at 1440×900 and 1280×720; demonstrate the reserved dock, light variant, and 390×844/320 px layouts. Keep the small schematic subordinate to real readings. Remove concept-only header/notes from implementation reference captures.
- Record the visual system and approved/recommended starting values. Update old visual-direction prose in `frontend/AGENTS.md` to avoid two competing layout instructions while retaining functional constraints.
- Run baseline frontend unit/build/Sites tests and existing browser behavior checks; record pre-existing failures separately.

**Exit:** every current function has a destination; references show usable navigation at actual viewport heights; baseline evidence is reproducible; unsupported features are excluded explicitly.

### [x] FD-02 — Tokens, typography, controls, and appearance parity

**Depends on:** FD-01. **Size:** M. **Targets:** `styles/tokens.css`, `components/ui/`, `accentColors.js`, `tests/accent-colors.test.mjs`.

- Implement dark and light semantic tokens for page/surface/text/borders/focus/accent/ready/attention/error. Default dark page stays `#000000`; light tokens are intentionally designed, not color-inverted.
- Use Bahnschrift with Segoe UI fallback for compact headings, Segoe UI for substantive 14–16 px text, tabular figures for values. No downloaded font dependency is required.
- Build consistent buttons, external-action labels, fields, validation text, focus, disabled and pending appearances. Use existing Feather imports; ensure every referenced icon is actually imported.
- Preserve saved accent values and Black's effective contrast behavior. Select readable foreground from actual luminance for custom fills; add an accessible outline/indicator when the selected accent itself has poor surface contrast. Do not silently rewrite the stored hex.
- New default blue can change to `#4A9AFF`; a previously stored blue remains as saved. Keep warnings/errors semantically separate from accent.

**Exit:** light/dark and existing presets work; representative near-white, near-black, saturated yellow, and custom accents retain readable text/focus. Meaningful foreground logic is unit-tested; measured contrast meets the plan's targets.

### [x] FD-03 — Extract shared presentation and expose resource state safely

**Depends on:** FD-02. **Size:** L. **Targets:** `App.jsx`, `presentation/resourceViewState.js`, `presentation/formatters.js`, `components/feedback/`; scheduler tests only if its contract changes.

- Extract existing pure helpers and UI primitives while leaving `api()`, profile/header capture, scheduler registration, invalidation, and mutation handlers in `App` initially.
- Implement the data-to-view contract above; retain `readyAt` diagnostics and use separate wall-clock freshness.
- Derive true loading/readiness instead of rendering `FALLBACK_SYSTEM` zeroes as real readings. Handle successful empty results and stale results separately.
- Add a concise global refresh summary with named failing resources and per-resource feedback. Retry affects only the selected resource.
- Avoid a broad “move all state into a new hook” refactor. Keep extraction and behavioral corrections reviewable.

**Exit:** the ten-second Calendar delay does not block other content; healthy polls do not introduce extra status-only render churn; hidden/resume behavior and mutation-race tests still pass; a real zero remains distinguishable from never-loaded.

### [x] FD-04 — Application shell and reachable navigation

**Depends on:** FD-02, FD-03. **Size:** M. **Targets:** `components/shell/`, `App.jsx`, `styles/shell.css`.

- Implement the reserved header/content/dock layout and keep existing view IDs. Settings can appear in both header and dock without becoming separate state.
- Add accessible narrow More navigation with pending-approval badge. Keep full labels/tooltips and selected-destination semantics.
- Keep lifecycle and local-profile access in the header; preserve global refresh notices without pushing navigation offscreen.
- Use one intentional vertical scroll region per main view; allow long documents/forms to reach their last action. Restore focus on navigation and avoid scroll traps inside ordinary panels.

**Exit:** every view is reachable by keyboard and pointer at all target widths; at 1280×720 and 390×844 the dock stays reachable while scrolling; no composer/control is obscured by dock, safe-area, or virtual keyboard.

### [x] FD-05 — PC overview, instruments, and Home assistant entry

**Depends on:** FD-03, FD-04. **Size:** L. **Targets:** `views/HomeView.jsx`, `components/dashboard/SystemOverview.jsx`, `components/instruments/`, `AssistantComposer.jsx`.

- Replace Home's old panel grid with controls/instruments/services composition. Migrate CPU/memory/storage, device identity, network/power, backend availability and account configuration distinctly.
- Implement SVG gauges with visible textual values, bounded fill, correct units, and null handling. Clamp only graphical fill; do not hide invalid source readings behind a plausible number. No invented history or temperature.
- Retain a small explicitly schematic PC visual; reduce/hide it at narrow/short sizes. Keep semantic content order aligned with visual order.
- Implement the actual text composer using `sendMessage`; submit once, show busy state, and preserve draft on failure. Remove the handler-free voice button, documenting that voice is not implemented.
- Keep composer on Home only; the Conversations view owns its own composer.

**Exit:** Home remains useful with backend failures and no connected services; no sample values ship; no unhandled action or inert voice control is presented as functional; non-empty/failed/successful assistant submissions behave correctly.

### [x] FD-06 — System controls and recent applications

**Depends on:** FD-05. **Size:** M. **Targets:** `SystemControls.jsx`, `RecentApps.jsx`, existing `systemControls.js`, `queueControl`.

- Direct controls use labeled switch semantics with last confirmed state. Settings-only controls are buttons named “Open … in Windows Settings,” with external icon/text and the existing approval path.
- Preserve pending-control protection and existing immediate confirmed-state merging. Rejected/failed requests do not make the visual switch appear successful.
- Migrate running/installed application rows, expand/collapse details, and show-more/compact behavior. Stack app rows on narrow screens. Do not create app-launch or historical-usage functionality.

**Exit:** direct/external/disabled/pending/failed controls are distinguishable without color alone; rapid repeated clicks submit only the intended request; current system-control and mutation-race tests pass.

### [x] FD-07 — Calendar and Phone Link panels

**Depends on:** FD-03, FD-05. **Size:** M. **Targets:** `CalendarPanel.jsx`, `PhonePanel.jsx`, `phoneDevice.js`, existing calendar/phone handlers.

- Split Calendar from media presentation while keeping existing data/handler ownership. Preserve previous/today/next, refresh, date selection and iCloud setup entry.
- Expand the selected day into a chronological agenda. Use a separate all-day section when the existing payload supports it; otherwise preserve source event semantics and document the gap. Overlaps remain readable list entries; no calendar editing or week-fetch loop.
- On date change do not label the previous day's data as the newly selected date; retain the existing selection-generation protection.
- Preserve phone refresh, copy device, detail expansion, external open, timestamps, missing battery, notification availability and known/unknown platform assets.

**Exit:** rapid day navigation cannot show a late wrong-date result; empty/disconnected/failed/stale days differ; a midnight or daylight-saving boundary does not shift the intended local day; missing phone metadata produces truthful placeholders.

### [x] FD-08 — System Info equipment sheet

**Depends on:** FD-03, FD-04, FD-05. **Size:** S. **Targets:** `views/SystemInfoView.jsx`, shared definition rows and instrument bars, `copySystemInfo`.

- Extract and restyle the existing view without dropping hardware/Windows/live fields. Reuse resource primitives and the current copy payload.
- Wrap long processor names/IDs; preserve units and actual availability. Give copy success/failure explicit feedback.
- A manual-refresh affordance uses the existing scheduler; it must not create a second polling path.

**Exit:** every old field still appears when supplied; long values fit at 320 px and 200% zoom; copied data remains equivalent to current behavior.

### [x] FD-09 — Compact player, full Music, and persistent embed

**Depends on:** FD-04, FD-05. **Size:** L. **Targets:** `CompactPlayer.jsx`, `views/MusicView.jsx`, `PersistentMusicEmbed.jsx`, `musicProviders.js`.

- Share supported playback controls across compact/full views. Keep track/artwork/time and shuffle/mute states driven by real Windows data.
- Keep a single persistent embed host outside conditional views. Preserve the existing provider/link key and deferred-first-visit behavior; do not key it by route, poll response, theme, or random values.
- Park the embed without making hidden content keyboard-focusable or screen-reader active. Verify the chosen hiding mechanism preserves real playback; do not assume it does from CSS alone.
- Frame third-party content honestly and render connection/login/session-missing states. Distinguish a saved provider link from an available Windows media session.

**Exit:** synthetic iframe identity survives repeated navigation and theme changes; provider switch replaces it intentionally; separate provider links survive switching; playback controls fit at 320 px; manual authenticated playback is checked separately from synthetic tests.

### [x] FD-10 — Approvals queue, scope, and results

**Depends on:** FD-03, FD-04. **Size:** L. **Targets:** `views/ApprovalsView.jsx`, `presentation/actionDetails.js`, existing action handlers; read-only reference to `ActionService.java` and `AssistantAction.java`.

- Add pending/history filters over the existing action list, selection, and full detail for all supported action kinds. Keep queue selection valid when items change or are completed.
- Use existing `arguments`, `reason`, `result`, `error`, and timestamps. Render user/model-provided content as text; no HTML execution or auto-opening destinations.
- Describe control-wide on/off reuse; exact normalized URL/Windows URI/path scope; and memory-category reuse. Clearly state that execution failure does not necessarily revoke the approval.
- Display full file path/content with bounded scrolling/expansion, link destination, or memory text/category as applicable. No inferred diff against existing file contents unless supplied by a verified source.
- Keep authorization in Java. The presentation helper describes the argument it receives; it must not calculate permissions or replace backend checks. No backend change is expected because `AssistantAction` already exposes the relevant fields. Unknown kinds receive a safe explicit unsupported-detail state.
- Track transient submitting by action ID and show backend statuses verbatim through readable labels; preserve reject/approve semantics and disable repeat submission.

**Exit:** fixtures for all five kinds, unknown kind, long content and every status render safely; Wi-Fi scope says both directions; rejection/failure does not show completion; no policy or matching behavior changes.

### [x] FD-11 — Memories and Conversations

**Depends on:** FD-03, FD-04, FD-10. **Size:** M. **Targets:** `views/MemoriesView.jsx`, `views/ConversationsView.jsx`, existing create/delete/select/send handlers.

- Migrate memory create/category/delete; add local category filters, useful empty states, and readable long content. Preserve failed drafts and retain the distinction between a successful save and a failed subsequent refresh.
- Migrate thread list/new-thread selection, transcript and composer. On narrow screens, thread selection is a disclosure/sheet; keep active thread identity visible.
- Make send success/failure explicit to the form so a failure does not silently discard text. Prevent duplicate sends while busy, handle selection races, and preserve current non-streaming behavior unless the actual contract changes.
- Show profile/key status and pending count only from available state. Do not attach an action to a message without a real association. Explain local history versus external OpenAI requests.

**Exit:** memory draft regression remains covered; thread switches cannot show a late wrong-thread response; failed sends retain retryable text; exactly one conversation composer is present; long transcripts remain readable and navigable.

### [x] FD-12 — Settings and appearance integration

**Depends on:** FD-02, FD-04, FD-07, FD-09. **Size:** M. **Targets:** `views/SettingsView.jsx`, current account/provider/appearance handlers.

- Build separate real forms for OpenAI, iCloud, music and appearance. Render only applicable connection state, unlike the gallery's combined anatomy demonstration.
- Preserve profile-key save/replace/remove, iCloud connect/disconnect, separate provider links, provider choice, refresh, and explicit external actions.
- Keep secret inputs masked, clear on successful save, never read back saved secrets, and show inline submission errors without mixing profiles. Regular Apple passwords are never requested.
- Wire existing theme/preset/custom-hex preferences into FD-02 tokens. Do not require developer credentials for music.

**Exit:** all form states work in light/dark and custom accents; validation explains recovery; switching provider retains the other link; no credentials enter logs, fixtures, screenshots or browser-visible saved responses.

### [x] FD-13 — Profiles and lifecycle flows

**Depends on:** FD-04, FD-12. **Size:** M. **Targets:** `components/profiles/`, `ConfirmDialog`, `runLifecycle`, `waitForRestartReady`, existing profile handlers.

- Migrate profile switch/create/rename/avatar/delete into a top-bar panel. Preserve browser storage namespaces and reload-on-switch. Protect default/last profile.
- Before eligible profile deletion, show the profile name and data scope; no optimistic deletion before backend success. Keep focus and cancel behavior correct.
- Restyle shutdown confirmation with exact frontend/backend scope and `start.cmd` recovery. It must never suggest Windows shutdown or an in-page restart after the backend is off.
- Keep restart available from the header and tied to actual readiness. Show reconnect timeout/failure without claiming success; keep duplicate requests disabled while pending.

**Exit:** keyboard focus enters/returns correctly; cancel changes nothing; protected profile deletion remains impossible; no old-profile data flash; runtime smoke and isolated lifecycle tests preserve ownership and unrelated listeners.

### [ ] FD-14 — Responsive, accessibility, and long-content completion

**Depends on:** FD-05 through FD-13. **Size:** M. **Targets:** all migrated CSS/components; browser interaction tests.

- Check the full viewport matrix, 200% zoom, keyboard-only navigation, reduced motion, screen-reader names/state, contrast and touch targets (aim for 44 px effective hit areas).
- Cover long app/device names, 2,000-character memory/action text, many queue/thread entries, long transcript, multiple/overlapping/all-day events, missing artwork/phone metadata, and backend-offline operation.
- Keep critical footer/dock/action areas reachable; no horizontal document scrolling. Confirm active navigation, More badge, Escape, focus restoration, native form labels and error relationships.
- Announce action outcomes and meaningful failures; do not announce every telemetry poll. Remove idle animations.

**Exit:** no clipping/hidden action at the named viewports; no keyboard trap or unnamed enabled control; no serious accessibility issue remains undocumented/unresolved.

### [x] FD-15 — Behavioral regression and performance comparison

**Depends on:** FD-14. **Size:** M. **Targets:** existing frontend tests, new `browser-redesign.mjs` and presentation-helper tests only where justified, diagnostics evidence.

- Run the command matrix below. Adapt selectors only where necessary; retain behavioral assertions rather than weakening tests to accommodate the redesign.
- Add meaningful coverage for dock reachability, dialog focus, action-scope details, first-load versus real-zero state, per-resource retry, appearance persistence/contrast, and failed chat drafts.
- Compare request counts and iframe mounts to FD-01. Capture production asset size and matched browser render/request evidence; investigate increased idle work, repeated requests, or unnecessary remounts.
- Use the longer CPU test only when measurements or changed rendering justify it. If used, pin the baseline commit and same environment. Do not describe synthetic results as end-to-end performance gains.

**Exit:** required suites pass; no new polling loop, mount churn, unexplained request increase, or material interaction regression; baseline/candidate evidence and limitations are recorded.

### [ ] FD-16 — Real integrations and packaged runtime

**Depends on:** FD-15. **Size:** M, with account/device availability dependency. **Targets:** production scripts, runtime smoke, evidence record.

- Build the production runtime and test native hosting/lifecycle in the isolated setup using free ports. Stop only the owned instance; do not kill arbitrary listeners.
- Exercise the real dashboard using a test profile: safe radio change/restoration where authorized, approved Settings launches, phone metadata, iCloud day refresh, provider playback/navigation, restart and shutdown/relaunch.
- Record each integration as passed, failed, or not verified with its blocker. A mock test is not a substitute for authenticated accounts or hardware.
- Create the package locally, verify extracted-package startup/manifest behavior, and retain stage-specific readiness evidence. No startup speedup claim is implied.

**Exit:** packaged app works with the native host and real backend; required supported integrations have evidence; unavailable account/device checks are explicitly recorded and resolved before declaring the corresponding behavior validated.

### [ ] FD-17 — Documentation, security review, and release candidate

**Depends on:** FD-15; complete FD-16 before release readiness. **Size:** S/M. **Targets:** root/frontend README, affected backend/native docs only if contracts change, `DESIGN.md`, design metadata, changelog/PR body.

- Update navigation, external-control labels, profile/approval explanations, appearance, recovery and troubleshooting. Remove superseded UI/setup instructions.
- Keep ports, runtime dependencies and hosting documentation aligned with actual behavior; leave unrelated installation contracts intact.
- Capture final representative screenshots, compare against the approved references, apply one bounded issue batch and verify it. Document deliberate differences.
- Run Codex Security review of the actual diff, especially secret forms, rendered action content, external links and approval presentation. Address blocking findings before shipping to `main`.
- Prepare a draft PR through the project's GitHub workflow with concrete before/after behavior, validation evidence, deferred items and screenshots. Keep all sample credentials out of artifacts.

**Exit:** reviewable release candidate, synchronized docs/design references, no unresolved blocking security or behavior issue, and honest integration validation status.

### [ ] FD-18 — Release, verification, and rollback readiness

**Depends on:** FD-17 and explicit release authorization. **Size:** S.

- Verify authoritative repository/branch/tag and final checks; publish through the existing repository workflow only when authorized. Do not assume a prior release authorization covers this redesign.
- Verify release assets/checksum/package link and smoke-test the exact distribution, not merely the source checkout.
- Retain the previous known-good runtime and a user-controlled local data backup. Document a rollback that stops the owned instance and restores the previous application files without deleting profile data.
- If a regression occurs, revert the smallest causal code change or restore the previous compatible package; never treat dropping local state or credentials as a visual rollback.

**Exit:** published version is verified, exact artifacts are linked, rollback instructions are usable, and validation limitations remain visible.

## 5. Dependency and PR sequence

```text
FD-01 → FD-02 → FD-03 → FD-04
                         ├→ FD-05 → FD-06 / FD-07 / FD-08 / FD-09
                         └→ FD-10 → FD-11
FD-02 + FD-04 + FD-07 + FD-09 → FD-12 → FD-13
FD-05…FD-13 → FD-14 → FD-15 → FD-16 → FD-17 → FD-18
```

The grouped PRs below are suggested review units. Build a usable app at every checkpoint; do not merge half-wired controls or release a mixed visual migration. PRs may remain stacked/draft until the complete redesign is ready. Use Git commits as checkpoints, not a permanent dual-UI runtime.

| Review unit | Packages | Demonstrable outcome |
| --- | --- | --- |
| 1. Baseline and contract | FD-01 | Reproducible baseline and complete visual contract |
| 2. Foundation | FD-02–04 | Shared tokens/state presentation/shell, every existing view reachable |
| 3. Overview | FD-05–08 | Home, controls, day/phone panels, apps, System Info functional |
| 4. Media | FD-09 | Shared player and persistent full Music experience |
| 5. Assistant workflows | FD-10–11 | Safe approvals, memories, conversation flows |
| 6. Preferences and lifecycle | FD-12–13 | Appearance/accounts/profiles/runtime complete |
| 7. Readiness | FD-14–17 | Responsive/accessibility/regression/live/package evidence and docs |
| 8. Release | FD-18 | Authorized, verified distribution |

**Sizing:** S = localized work with limited integration; M = multiple components and focused browser checks; L = stateful integration with several regression paths. These are relative engineering sizes, not calendar commitments. Re-estimate after FD-01 exposes baseline failures and account/hardware availability; waiting for credentials or release approval is not engineering execution time.

## 6. Validation commands and evidence

Run from the repository root unless stated. Use the existing Node/pnpm/JDK/build-tool prerequisites documented in the READMEs. Do not silently install or upgrade dependencies to make a visual change pass.

**During migration / touched behavior:**

```powershell
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:sites
```

**Browser regression:** start a separate test server in its own terminal, then run the suites in another:

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 4174 --strictPort
```

```powershell
npm --prefix frontend run test:browser
node frontend/tests/browser-mutation-races.mjs
# New entry point to be created in FD-15, not available in the baseline:
node frontend/tests/browser-redesign.mjs
```

**Final native/production candidate:** requires the documented native toolchain, Java, Playwright dependencies and installed Edge; 4173/4317 must be free of unrelated listeners. These scripts create/use isolated test installations where documented.

```powershell
.\scripts\build-production.ps1
.\scripts\test-native-host.ps1
.\scripts\test-production-startup.ps1
npm --prefix frontend run test:sites
.\scripts\package-production.ps1 -SkipBuild -IncludeJavaRuntime
.\scripts\test-production-startup.ps1 -PackagePath .\dist\Live-Desktop-windows-x64.zip
```

The production build already includes frontend unit/build work and backend packaging; do not duplicate it repeatedly without a reason. `test-production-startup.ps1` covers the runtime browser smoke as documented. Run Windows bridge tests additionally if native/control contract work is introduced or relevant failures warrant it. If the backend is changed for any justified contract reason, run its focused tests and the existing Maven suite; the baseline redesign does not require a backend API change.

**Optional measured regression investigation:** `node frontend/tests/browser-cpu-performance.mjs` with its test server. It is a longer synthetic browser experiment; compare to the pinned baseline and do not conflate it with full-app CPU or authenticated playback.

### Evidence matrix

| Evidence | Required scope | Record |
| --- | --- | --- |
| Unit/build/Sites | Each affected checkpoint and final candidate | Command, commit, result, failure details |
| Browser behavior | Scheduling, state, controls, profile headers, iframe identity, drafts | Fixtures, browser version, request/mount counts, test result |
| Visual | All seven views; supporting panels; states; light/dark and representative custom accent | Viewport, fixture/profile, theme, commit, screenshot |
| Responsive | 1920×1080, 1440×900, 1280×720, 768×1024, 390×844, 320 px width, 200% zoom | Overflow, reachable last action/dock, focus checks |
| Accessibility | Names, labels, contrast, keyboard/focus, dialogs, status announcements, reduced motion | Method, findings, fixes and outstanding limits |
| Real services | Windows/Phone Link/iCloud/Apple Music/Spotify/OpenAI as applicable | Real versus mocked, account/device availability, exact action/result |
| Package/runtime | Built and extracted ZIP; restart/shutdown/ownership | Manifest/package identity, stage-specific readiness and smoke results |

Store non-secret evidence in `docs/redesign/implementation-validation/` with a summary linking to existing test output paths. Keep large generated logs/screenshots in the existing artifact/target locations as appropriate; commit only useful review evidence. Never overwrite the historical concept validation record with production claims.

## 7. Rollout, rollback, and completion criteria

Use a dedicated implementation branch and reviewable commits. Keep changes additive during extraction, then remove superseded view markup and CSS as each new version is wired. Do not add a user-visible “old/new dashboard” preference, new persistent schema, or migration requiring profile resets. Any temporary development comparison mechanism is removed before the final package.

Before final runtime validation, identify the actual owned Live Desktop instance and stop it through its supported lifecycle. Do not use name/port-based mass termination. Keep unrelated listeners and user processes intact. For rollback, restore the prior compatible code/package and preserve profile data; secrets remain tied to their existing Windows user protection.

The redesign is implementation-complete when FD-01 through FD-17 satisfy the checks below. Distribution is release-complete only after the separately authorized FD-18; waiting for publication does not erase completed implementation work.

- [ ] FD-01 through FD-17 are completed or the user explicitly accepts a documented scope change; release remains separately authorized.
- [ ] All seven views and all existing supported actions are implemented, with no concept controls or sample readings in production.
- [ ] Home is PC-first, dock is reachable, and no important function disappears at the target widths/zoom.
- [ ] Loading, empty, stale, failed, unavailable, pending, rejected and completed states are distinguishable.
- [ ] Scheduler behavior, mutation ordering, profile isolation, provider continuity, credential handling and approval semantics are preserved.
- [ ] Light/dark/custom accents, accessibility, long content and reduced motion are verified.
- [ ] Required automated checks pass and real integration/package evidence is recorded distinctly from mocks.
- [ ] Final references, READMEs, PR description, security review and rollback notes match the delivered implementation.

If an account/device is unavailable, work can continue on independent packages. Mark the affected integration as unverified and name the exact missing input; do not call the whole redesign release-ready by substituting synthetic success.
