# Live Desktop — Flight Deck redesign plan

**Status:** full implementation plan, expanded November 1, 2026 from the October 15 concept study. The user authorized implementation on November 1, 2026. The Flight Deck UI is implemented locally; validation and remaining release gates are recorded in [implementation validation](implementation-validation/README.md). Nothing is published.

**Execution entry point:** [EXECUTION_BACKLOG.md](EXECUTION_BACKLOG.md) contains 18 ordered work packages with dependencies, file targets, behavior contracts, acceptance criteria, test commands, PR boundaries, and rollback steps. Read this document for design intent and scope, then execute the backlog. The backlog now records delivered packages and outstanding acceptance gates.

**Confirmed direction:** SpaceX vehicle-overview inspiration, whole-dashboard coverage, PC overview first. **Recommended concept:** Flight Deck, an instrument-centered overview with familiar application views inside one restrained black shell.

## 1. What the reference contributes

The supplied image is the visual authority for this exploration. Borrow its large black field, disciplined panel alignment, white lettering, blue quantitative indicators, peripheral control columns, central equipment identity, and lower navigation. Replace the spacecraft with a small PC schematic grounded in the product. Preserve readable task names rather than inventing aerospace terminology for ordinary settings.

Adapt the reference where everyday use needs it: increase text contrast, support long content and forms, label external actions explicitly, and provide keyboard focus and narrow layouts. No SpaceX logo, spacecraft art, artificial countdown, animated star field, radar, fake waveform, or invented system telemetry is required.

The direction-seeding exercise was run. The user-pinned SpaceX reference governs the proposal over unrelated generated directions. The developer-console alternative reinforced clear permission copy and isolated destructive controls; a catalog treatment would hide too much operational information. A full visual-world selection exercise is unnecessary when the user has supplied this clear reference. The gallery presents one coherent proposed world across all surfaces rather than unrelated themes.

## 2. Verified current product inventory

Source rechecked on November 1, 2026 at Git HEAD `5d7539f`: `frontend/src/App.jsx`, `frontend/src/resourceScheduler.js`, the frontend package scripts and README, project instructions, `AssistantAction.java`, `ActionService.java`, and production build/test entry points. The existing concept documents are still untracked working-tree artifacts, and the root README has the prior concept link. Preserve these files when creating an implementation branch. The earlier October 15 frontend preview had its backend offline; its screenshots are historical design evidence, not current live integration validation.

The current application still matches the seven-view inventory below. Three implementation details require deliberate handling: healthy resource statuses mostly stay in refs rather than reactive UI state; the provider iframe is a persistent sibling of the changing view; and the Home voice-input button has no handler. Work packages FD-03, FD-09, and FD-05 respectively address these details without inventing capabilities.

| Existing source / function | Concept treatment | Preservation requirement |
| --- | --- | --- |
| `App`, `NAV_ITEMS`, topbar, `ViewShell` | Shared runtime header, readable page title, lower labeled navigation | Seven existing destinations including Settings; visible runtime and profile controls |
| Home control strip, `Toggle`, `CONTROL_ORDER` | Compact left control rail | Wi-Fi/Bluetooth direct; other capabilities open approved Windows Settings routes |
| `SystemHealth` | CPU, memory, storage instruments; network/power text; connection rows | Null/unavailable distinct from zero; no fake history |
| `RecentApps` | Quiet rows with compact/expanded list and inline details | Running/installed distinction and existing show-more behavior |
| `CalendarAndMedia`, `AgendaItem` | Compact agenda, expanded day panel | Date selection, previous/today/next, refresh, iCloud setup, event content and empty/error states |
| `PhonePanel`, `PhoneAction` | Phone status in service rail, expanded device panel | Refresh, copy name, details, external open, platform-aware illustration, real metadata only |
| `AssistantBar` | Narrow Home composer/entry | Text submission and busy feedback; any voice entry must reflect actual supported behavior |
| `SystemInfoView`, `DetailRows` | Equipment sheet and current resource bars | Hardware, identifiers, OS details, copy action, actual reported values |
| `MusicView` and persistent iframe sibling | Compact custom player above the selected provider embed | Artwork, track, artist, album, time, previous/play-pause/next/shuffle/mute; persistent mounting |
| `ApprovalsView` | Pending queue and readable action/scope details with history | Approve/reject and complete lifecycle; reusable scope must match backend policy |
| `MemoriesView` | Categorized readable list and compose area | Add, category, delete, preserve content on failed save |
| `ConversationsView` | Thread rail, transcript, composer, optional context rail | New/select/continue conversation, busy/error feedback, profile ownership |
| `SettingsView` | Dedicated form sections and appearance preview | OpenAI key, iCloud connect/disconnect, music provider/links/status, theme/accent persistence |
| `ProfilePicker` | Top-bar side panel | Switch/create/name/avatar/delete; default/last-profile protections; reload-on-switch |
| `ShutdownDialog`, `LifecycleNotice` | Focused shutdown confirmation and visible lifecycle status | Stop frontend/backend only; readiness-based reconnect; truthful restart limitations |
| Resource refresh banner and scheduler state | Per-resource freshness plus concise global failure summary | Independent loading, last-known data, background polling behavior and mutation safety |

## 3. Proposed screen concepts

### Home — the PC overview

Use three primary columns on a wide screen: system actions, instrumentation, connected services. CPU, memory, and storage use large numeric values within restrained rings. Network and power remain text because a ring would imply a quantity that those statuses do not provide. Beneath the instruments, a simple PC schematic establishes device identity, and connection rows distinguish backend availability from external account configuration.

The service rail holds today's iCloud events, phone status, and compact playback. Recent apps remain below the primary instruments, with expansion in place. The assistant composer is a secondary action, separate from primary navigation. Keep the initial overview useful even with no API key or connected integrations.

Do not say “all systems nominal” just because three numbers are present. Avoid invented thresholds or treating a configured API key as proof that the external service is online.

### System Info — equipment sheet

Use a top strip of three resource bars and two aligned definition lists for hardware and Windows details. Put identifiers in readable, copyable rows rather than decorating them as gauges. Preserve all currently displayed fields; avoid hiding values solely to make the composition cleaner. Long device/processor names and IDs must wrap safely. Copy retains the existing payload.

### Music — playback console

Keep the existing compact player language and enlarge it only enough to expose artwork, metadata, elapsed/duration, and supported playback actions. Frame the selected Apple Music or Spotify embed beneath it. The provider-owned content is an explicit boundary: its internal UI cannot be restyled by this project.

Do not remount the iframe on ordinary navigation or polling updates. Preserve its current deferred-first-visit mounting, per-profile provider links, and intentional replacement on provider changes. No queue editor, equalizer, volume control, waveform, or seek behavior is added unless already supported and verified.

### Approvals — request review

Show a queue beside a focused request detail. Lead with a human-readable action and its consequences. Follow with target and **the exact reusable scope**. Separate reject from approve, and show status after execution.

The backend currently keys direct control approval by control name, **not by the on/off value**. A first Wi-Fi approval therefore covers subsequent Wi-Fi changes in either direction for the current profile. The design must say this explicitly. Other existing keys are normalized file path, normalized browser URL, Windows URI, or memory category depending on action kind. A failed execution can still count as a prior approval under the current policy. Do not imply failure revoked the permission.

Use actual backend action statuses (`pending`, `approved`, `completed`, `failed`, `rejected`) and a separate transient client “submitting” state where needed. Do not fabricate a persistent backend `running` state. File-write review should expose the actual path and content; URI review should expose its destination; memory review should expose its content and category. Existing payloads need to be checked for completeness before a richer detail panel is considered finished.

“Approve once,” “always allow,” bulk approval, and grant revocation are not part of this visual migration. A small backend-supplied scope-description field may be preferable to duplicating approval-key semantics in JavaScript, but requires a separately reviewed contract change if needed.

### Memories — local record

Use a text-first list with visible categories and a nearby compose area. Preserve add and delete operations. Optional category filtering can be entirely local over the existing result. Keep failed drafts in place and show actionable error text. Do not add edit/version/restore/bulk operations without expanding scope.

### Conversations — communications workspace

Use a quiet thread rail, a readable transcript, and a composer. The same shell and typography make it part of the dashboard, while the central column favors prose rather than instrumentation. On a wide screen a narrow context panel can show current profile, configured-key state, and pending action count from existing state.

A message-specific action card needs a reliable association between that message and the action; do not infer it from proximity or timestamps. Preserve the current request flow unless that association already exists. Explain local history separately from external OpenAI requests. Never claim all inference or requests remain on the PC.

### Settings — connection and appearance workbench

Organize OpenAI, iCloud, music, and appearance as distinct sections with stable field labels. Each connection has disconnected, saving/connecting, connected, validation failure, network failure, and disconnect/removal states. The gallery exposes multiple states together for anatomy review; production renders the applicable state.

Keep credentials write-only after save. Maintain DPAPI-backed handling, profile scope, separate music provider links, and provider-login boundaries. Preserve existing accent presets, custom hex validation, light/dark mode, and the Black-accent contrast rule. Default Flight Deck uses black and blue; existing stored preferences must not be silently overwritten. Semantic warning/error colors do not become arbitrary user accent colors.

### Supporting panels

- **Calendar:** expand the existing day view into a usable agenda; keep it read-only and rooted in the selected date. This is richer presentation of existing data, with all-day and overlapping-event handling verified before implementation.
- **Phone:** expand status and device details within Home. Preserve refresh/copy/details/external open and platform-aware assets. Unknown battery stays unknown; private messages and call handling stay in Phone Link.
- **Recent activity:** compact/expanded observed application list, including installed/running labels and row detail. No invented historical usage or productivity score.
- **Profiles:** open from the top bar as a side panel, full-width at narrow sizes. Keep create, switch, rename, avatar, and eligible delete actions. Do not present these as separate Windows accounts or an authentication feature.
- **Lifecycle:** restart and shutdown remain accessible in the top bar. Confirm shutdown with exact scope and recovery instructions. Restart completion follows actual service readiness, not a timer.
- **Shared states:** neutral loading, clear empty states, unavailable values, stale data with age, failed reads with retry, pending mutations, action failures, and missing credentials all use the same type and status vocabulary.

## 4. Proposed visual system

| Element | Proposal |
| --- | --- |
| Page surface | `#000000`, preserving the true-black requirement |
| Raised instrument surface | `#090C10` |
| Structure | `#303943` hairlines; stronger boundaries for interactive controls where required |
| Primary / secondary text | `#F1F4F6` / `#A0ADB9` |
| Default accent | `#4A9AFF` for interaction and quantitative values; existing saved accents remain valid |
| Ready / attention / error | `#85D9BD` / `#FFC56D` / `#FF8589`, always with text/icon cues |
| Headings | Bahnschrift concept treatment; verify installed Windows font behavior and define fallback before lock |
| Body | Segoe UI, 14–16 px production target, sentence case and comfortable line height |
| Measurements | Tabular figures; monospace limited to numbers, IDs, dates and units |
| Labels | Short 11–12 px labels, moderate tracking; avoid small low-contrast prose |
| Geometry | Rectangular panels, 0–4 px corners; circular geometry reserved for useful instruments and identity |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 px scale |
| Interaction | White filled primary button, outlined secondary, explicit external action, separated destructive button |
| Motion | 120–180 ms purposeful state transitions; no idle decoration or perpetual gauge animation |

The gallery is a high-fidelity composition study, not a finished accessibility or typography specification. Production requires measured contrast (4.5:1 normal text, 3:1 large text and meaningful non-text controls), visible focus, sufficient pointer targets, and 200% zoom support. Compact visual controls can use larger hit areas without changing their perceived density.

## 5. Responsive behavior and keyboard model

- **Wide desktop:** three overview columns; seven labeled destinations in the bottom dock. Keep primary PC information visible at common laptop heights, even when a header/status notice is present. Current review tooling adds height that production will not have.
- **Medium widths:** retain instruments as the primary region, move service panels into a second row, reduce metadata rather than text legibility.
- **Narrow widths:** instrument summary first, system controls next, services after. Reduce the PC schematic before reducing readable data. Conversations use a thread-selection panel; side panels become full width. Never require horizontal page scrolling.
- **Primary navigation:** production dock should remain reachable in a reserved/sticky bottom region without covering the composer or content. At narrow widths use Overview, System, Assistant, and a labeled More menu containing Music, Approvals (with badge), Memories, and Settings. The gallery exposes all seven destinations to simplify review; final mobile navigation is an open composition decision.
- **Keyboard:** follow reading order, expose selected navigation with `aria-current`, use semantic switches only for actual direct toggle operations, and preserve visible focus. Use native disclosure semantics for expand/collapse.
- **Dialogs:** move focus into shutdown/profile-delete confirmation where appropriate, trap it only for true modal interactions, support Escape, and return focus to the triggering control. Do not treat ordinary panel expansion as an interruptive modal.
- **Live status:** announce completion/error/pending approval meaningfully; avoid announcements on each routine numeric poll. Missing values render as a dash plus explanation.

## 6. Implementation strategy

Keep this as a frontend migration. The current Java policy, native execution, production launcher/host, and integration contracts are preserved. Component extraction is justified by the large combined `App.jsx`, but should not become a replacement of the state/data layer.

Proposed organization, to be adjusted to the repository's conventions during implementation:

```text
frontend/src/
  App.jsx                         # composition; retain existing orchestration initially
  components/shell/              # header, labeled dock, page heading, profile panel
  components/instruments/        # resource gauge, value, bar, freshness indicator
  components/feedback/           # empty/error/pending states, confirmation
  components/dashboard/          # controls, agenda, phone, apps, assistant entry
  views/                         # one component per existing view
  styles/tokens.css              # semantics; dark/light/accent mapping
  styles/shell.css
  styles/views.css
```

Keep `resourceScheduler.js`, `systemControls.js`, `musicProviders.js`, `accentColors.js`, and profile/API flows authoritative. Do not introduce duplicate request hooks or intervals inside extracted panels. Keep the selected-provider iframe outside content that unmounts with navigation. Reuse existing Feather imports, repair missing icons if encountered, and avoid adding an icon/font/CDN dependency simply for the redesign.

### Phase A — lock the visual contract

Deliverables: approved Home composition plus representative Approvals, Conversations, Settings, narrow layout, and failure state. Confirm bottom dock, degree of instrument density, and expanded calendar scope. Capture the approved screens as reference images and write `DESIGN.md` with tokens and the corresponding design metadata only after the direction is accepted.

Exit: the user can identify where every existing function belongs; new optional behavior is explicitly accepted or excluded. The current broad reference and PC-first priority are already confirmed.

### Phase B — establish the shell and primitives

Extract presentation components while retaining handlers and state ownership. Add semantic tokens and build header, dock, page heading, buttons, form fields, status labels, resource displays, and shared feedback. Implement dark and light token sets with the existing accent adaptation rules. Keep lifecycle controls and profile access in the top bar.

Exit: every existing view is reachable, keyboard focus is visible, layout works at 1440×900 and 390×844, and no polling/integration behavior changes. Snapshot the old implementation before switching the shell for straightforward Git rollback. A temporary development-only comparison entry can help; do not ship two independent dashboards or persist a new theme choice without explicit scope.

### Phase C — migrate Home and System Info

Build the resource instruments, control rail, connection rows, compact agenda/player, phone panel, and recent applications. Add null/stale/error states alongside each component. Migrate System Info using existing fields and copy payload. Implement only approved module expansions.

Exit: Home remains useful with zero connected accounts; slow Calendar does not gate other modules; missing battery/metadata is truthful; direct and external controls are distinguishable; reported mutation results are not overwritten by late reads.

### Phase D — migrate assistant and decision views

Migrate Approvals, Memories, and Conversations. Preserve queue actions, capability semantics, draft retention, thread selection, and profile isolation. Verify action-scope disclosure against `ActionService.approvalKey`; add a narrowly scoped backend description only if presentation cannot safely express the existing contract.

Exit: pending → submitted → completed/failed paths are clear; reject is distinguishable; repeated approval semantics are explained; failed memory save preserves text; long conversations remain readable and keyboard usable.

### Phase E — migrate integrations, preferences, and profiles

Migrate full Music, Settings, profile panel, and lifecycle dialogs. Preserve embed continuity and account/provider constraints. Complete date/time edge cases, known/unknown phone assets, write-only secret forms, light/custom-accent parity, and all connection-state variants.

Exit: profile switching shows no prior profile state; provider switching preserves each provider link; ordinary navigation does not reload playback; no credentials appear in logs, browser responses, screenshots, or saved fixtures; shutdown/restart wording and ownership remain correct.

### Phase F — validate and prepare a release

Run the existing meaningful checks, then browser checks specific to the migrated surfaces. Compare the approved concepts to actual screenshots in a bounded visual review. Update affected READMEs and replace obsolete layout/setup descriptions. Complete Codex Security review before any shipping to `main`; use GitHub for the branch/PR workflow when that work is authorized. Prepare a reviewable build or draft PR; publication still needs explicit release approval.

Exit: required tests pass, known limitations are documented, no unexplained contract or performance regression, production launch/ownership behavior is unchanged, and the user has reviewed the implemented direction. A concept screenshot or successful build is not proof of live hardware/account behavior.

## 7. Validation matrix for implementation

| Area | Evidence needed |
| --- | --- |
| Component/data safety | Existing frontend unit tests: `npm --prefix frontend test` |
| Packaging | `npm --prefix frontend run build` and `npm --prefix frontend run test:sites`; preserve client/server/Sites outputs |
| Scheduling/rendering | Existing `browser-performance.mjs` harness on its isolated 4174 server; ensure delayed Calendar does not block local content |
| Mutation races | `node frontend/tests/browser-mutation-races.mjs` with the test server; verify late reads and failed draft saves |
| Resource boundaries | No extra request intervals; background pauses/resumes remain deduplicated; visible cadence matches current README |
| Music | Existing synthetic iframe-continuity checks plus manual authenticated provider playback and navigation verification |
| Profile isolation | Switch between two test profiles with different appearance, memories, conversations, keys, and provider links; verify headers and no old-state flash |
| Windows controls | Actual direct radio operations and approved external Settings paths, separately from mocked browser tests |
| Approval policy | First and repeated requests; rejection; execution failure; visible scope matches control/path/URI/category policy |
| Visual fit | 1920×1080, 1440×900, 1280×720, 768×1024, 390×844, 320 px width, and 200% zoom; long content and all major states |
| Accessibility | Keyboard-only workflows, labels/names, active navigation, focus restoration, dialogs, color contrast, reduced motion, screen-reader status announcements |
| Production runtime | `scripts/build-production.ps1`, lifecycle suite and built-runtime smoke under existing documented prerequisites; port ownership and launch-to-ready semantics preserved |
| Performance | Matched before/after browser and real-app observation; keep idle animation absent and component updates local. Do not claim a speedup from unrelated or synthetic measurements |
| Documentation | Root/frontend README, affected setup/security/troubleshooting; no competing obsolete setup instructions |

Only run expensive CPU/startup comparisons when the migration changes a relevant path or evidence indicates regression. Existing tests cover important behavior; do not write tests that merely restate styling or markup.

## 8. Risks and boundaries

| Risk | Mitigation |
| --- | --- |
| Design looks impressive but obscures daily tasks | Keep familiar labels, visible controls and real data; review Home at laptop height |
| Gauge animation increases idle CPU | SVG/CSS updates only when readings change; no animation loops or canvas renderer |
| App extraction introduces data races | Retain scheduler/handlers first; extract UI without moving async ownership |
| Approval copy under-describes permission | Ground copy in backend keys; Wi-Fi approval covers both directions |
| Provider embed disrupts appearance or playback | Style surrounding frame only; keep mount identity stable |
| Dark-only redesign removes preferences | Implement light tokens and contrast-safe custom accents before completion |
| Diagram implies exact detected hardware | Label as a schematic; adapt or omit where device type is unknown |
| Calendar expansion becomes a new feature project | Limit to existing read-only event data; defer editing/invitations |
| Mock values enter production | Keep concept fixtures in `docs/redesign`; runtime views consume only real state and explicit fallback states |

## 9. Planning defaults and implementation boundary

Use these defaults to make the work executable; they are recommendations for implementation, not claims of additional user approvals:

1. Keep the three-column desktop overview and a small PC schematic; hide the schematic before reducing useful data at short/narrow sizes.
2. Use a reserved bottom navigation row in the application shell, outside the scrolling view. On narrow screens show Overview, System, Conversations, and More; More contains Music, Approvals with pending count, Memories, and Settings. Settings and lifecycle remain available in the header.
3. Include read-only expansion of the existing day agenda and client-side memory category filtering in the proposed scope. Do not add event editing, invitations, new server filters, or memory editing.
4. Retain seven view IDs and current profile/storage/API behavior. Do not introduce a router, state-management framework, new paid service, new native capability, or data migration for this visual update.
5. Use the Flight Deck blue for new profiles/defaults; preserve all saved accent values. Deliver light mode and contrast-safe custom accents in the same redesign.
6. Implement Home's real text composer, not the gallery's inert conversation shortcut. Remove the nonfunctional voice control until a separate voice feature is implemented.
7. Refine representative screens at real laptop/mobile sizes in FD-01, including reachable navigation and a light variant. Do not rerun an unrelated visual-direction tournament or repeatedly request permission for routine reversible implementation decisions once implementation is authorized.

The remaining choices are visual tuning, not missing product requirements. The backlog gives acceptance gates and an explicit release boundary. No completed implementation, live validation, delivery date, or performance improvement is asserted by this plan.
