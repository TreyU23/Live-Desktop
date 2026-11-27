# AGENTS.md: Live Desktop

Instructions for any AI coding agent working in this repository (`TreyU23/Live-Desktop`, local copy at `C:\Users\treyu\Personal Code\Live-Desktop`). The owner is Trey. This file is the root contract; `frontend/AGENTS.md` adds the frontend workflow and holds the CLI-managed Astryx block, and `docs/PROJECT-WORKING-GUIDE.md` has the detailed procedures it points to.

**Order of authority when sources disagree:** Trey's current message in chat, then this file, then `docs/PROJECT-WORKING-GUIDE.md`, then the other docs. Source code, scripts and current documentation govern *implemented* behavior; old plans, past test results and generated mockups prove nothing about the current checkout.

---

## 1. The four rules that outrank everything else

1. **Never commit, tag, merge, rebase, reset or push code changes yourself.** Trey commits every code change himself, after reviewing it. Leave edits in the working tree and ask for review (section 4). The one exception is an explicit release request (section 6).
2. **One problem, one review prompt.** When several issues are in flight, finish one, present it, wait for "looks good", then continue with the next. Never bundle unrelated fixes into one review.
3. **Review for security and update every affected document before your final output**, and before handing back any code change (sections 7 and 8).
4. **Correct beats fast.** Verify instead of guessing. Report what was and was not checked, plainly (section 9).

---

## 2. What this project is

Live Desktop is a local Windows dashboard: PC state first, then approved controls, conversations with an AI assistant, inspectable memories, iCloud Calendar, Phone Link status, and Apple Music/Spotify. "Local" does not mean offline: profiles and state stay on the PC, while OpenAI, iCloud and the music providers are external services.

| Layer | Responsibility | Where |
| --- | --- | --- |
| React/Vite frontend | Presentation, drafts, navigation, local UI preferences, requests to the local backend | `frontend/` |
| Java 21 / Spring Boot backend | Profiles, persistence, integration logic, **approval policy**, OpenAI/Claude orchestration, calendar | `backend/` |
| C++ Windows components | Launcher, frontend host, Windows bridge, JNI credential DLL (DPAPI) | `native/` |

Keep the separation: approval and profile policy live in Java; the native bridge only executes constrained Windows operations. Never add arbitrary shell execution, arbitrary registry/file-path operations or arbitrary process-kill to the bridge.

Seven views must stay reachable (IDs and `aria-current` preserved): Overview, System Info, Conversations, Music, Approvals, Memories, Settings.

Read before substantive work: this file, `frontend/AGENTS.md`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `backend/README.md`, `frontend/README.md`, `native/README.md`, `docs/VALIDATION.md`, `docs/PACKAGES.md`, and the working guide section that matches the task.

---

## 3. Starting any task

1. `git status --short`, `git branch --show-current`, `git remote -v`. Identify existing uncommitted changes and **preserve them**. Unrelated edits (for example `.vscode/settings.json`) are Trey's; never stage, revert or "tidy" them.
2. Work out which layers the task touches (frontend, backend, native, packaging, docs).
3. Trace the current implementation before designing a replacement.
4. Identify the validation commands (section 5) and the documents that will need to change (section 8).
5. Decide whether the request is local implementation only, or also includes a release. Implementation never implies publication.
6. If the change has a real design problem, stop and talk it through with Trey before building. Minor concerns get a mention, then continue.
7. For ambiguous cheap work, proceed on the most likely reading and say "Assuming you mean...". If a wrong guess would waste real effort or touch files, ask first.
8. Do all code changes locally in the working tree. Do not push or open anything remote to "get something done".

Tool priority, per the project instructions: **use the available plugins and connectors when called on, and prefer them over skills.** GitHub reads, issues and releases go through the GitHub connector/integration. Use a browser tool to look at running UI. Retrieve earlier project decisions from the project docs and memory before re-deciding something. Do not claim an integration ran when only a similar manual check was done. `gh` may not be on the PATH of the sandbox shell and may not be authenticated on the PC; never assume it is.

---

## 4. The review-and-commit loop (how every change ships)

This is the heart of the workflow.

### 4.1 What the agent does

1. Make the change in the local working tree on the current branch (normally `Development`).
2. Run the checks that fit the change (section 5) and update documentation (section 8).
3. Do the security review (section 7).
4. **Present the change for review**, one prompt per problem, containing:
   - what changed and why, in a few lines;
   - the files touched (so the diff is easy to open) and anything deliberately left alone;
   - what was run, what passed, what was skipped or could not be run;
   - documentation updated, and the security-review result with its real status (formal scan vs. targeted read);
   - the exact paths to stage and a suggested commit message (see 4.3).
5. **Stop and wait.** Do not start the next problem's edits in a way that mixes into this review. When Trey says it looks good, he commits; then continue.

### 4.2 What the agent never does

- `git commit`, `git tag`, `git push`, `git merge`, `git rebase`, `git reset`, `git cherry-pick`, `git stash drop`, `git checkout -- <file>`, `git clean`, or any history rewrite, for code changes.
- `--force`, `--no-verify`, or `--no-gpg-sign` anywhere, ever.
- Edit git config, hooks, signing keys or the `allowed_signers` file.
- Delete or switch branches, or create a branch without being asked (section 4.4).
- Commit logs, `data/`, `.env`, `dist/`, `.startup-metrics.jsonl`, `.claude-tmp/` scratch output or anything else in `.gitignore`.

### 4.3 Making review and commits easy

- **Atomic scope.** One logical change per commit: one bug fix, one feature slice, one doc pass. A fix and its test and its README line belong together; two unrelated fixes do not. This matches existing history (`06144ff`, `25826b9`, `bfdbe6b`, one concern each).
- **Name the paths.** Give Trey a `git add <paths>` line. When two changes touch the same file, say so and give the hunks, so he can use `git add -p`; better, finish and commit the first before editing the second.
- **Message style.** Match the existing log: a short imperative sentence, sentence case, no prefix and no trailing period, for example `Keep a refused localStorage write from crashing the app`. Add a body only when the *why* is not obvious. Release commits are named `Release X.Y.Z`.
- Do not add attribution trailers to a message you only *suggest*; Trey owns the commit and its trailers.
- **Signing.** Every commit and tag from Trey's PC must show **Verified** on GitHub (SSH signing; global git config already has `commit.gpgsign` and `tag.gpgsign` on). Details in `claude/commit-signing.md` in the Claude project. Consequences for agents:
  - Work done in a **cloud workspace** is signed by a key GitHub does not know and shows `Unverified: unknown_key`. Do not push those commits. Hand changes over as patches (`git format-patch`, applied on the PC with `git am`) or as a working-tree diff, so the PC creates fresh signed commits.
  - Already-pushed history and tags stay as they are; re-signing would rewrite published history.

### 4.4 Multiple problems at once

1. List the problems and an order (dependencies first, riskiest last).
2. Work them strictly one at a time, each with its own review prompt.
3. If a later fix depends on an earlier uncommitted one, say so, and wait for the commit before building on it.
4. If something unrelated turns up mid-fix, do not fix it silently. Report it, and (if it came from a code review) file an issue (section 10).

---

## 5. Branches, merging and history

### 5.1 The branches that exist

| Branch | Role | Rules |
| --- | --- | --- |
| `Development` | Integration branch; **all day-to-day work happens here.** Tracks `origin/Development`. | Commits come only from Trey (section 4). Never force-push. |
| `main` | The released line; `origin/HEAD` points here. Every release tag sits on a `main` commit. | Only moves at release time, by **fast-forward from `Development`** (3.1.2: `2b2661a..1cd24ea`, with `main` = `Development` = tag commit). Never commit to `main` directly. |
| `v3.x.y` tags | Annotated, SSH-signed release tags on the PC. | Immutable once published. Never move, delete or re-create a published tag. |
| `remotes/bundle/Development` | A leftover remote-tracking ref from a bundle import. | Ignore it. Do not base work on it or delete it unasked. |

Everything else (feature, fix or spike branches) is the exception, not the routine. The project used one throwaway branch for the Astryx spike; the redesign itself landed as one commit per phase and per view on `Development`. Create a short-lived branch **only when Trey asks** or when the work is a risky experiment he approved. If one is wanted, suggest a name such as `fix/<short-topic>`, `feature/<short-topic>` or `spike/<short-topic>` and let him decide. It is branched from and merged back into `Development`, never into `main`.

### 5.2 Merging

- `Development` to `main` is **fast-forward only** (`git merge --ff-only`), done at release time. If a fast-forward is impossible, stop and tell Trey; do not create a merge commit or rebase to make it work.
- No squash merges and no GitHub web-UI merges of signed work: they replace the signed commits with new ones signed by GitHub and break the link between the tag and the verified release commit.
- Never rebase or amend commits that are already on `origin`. Rebasing purely local, unpushed commits is Trey's call, not an agent's.
- No pull-request flow is in use at the moment. If Trey asks for a PR, ask which merge method he wants before suggesting one.
- Resolve conflicts only on request, explain each resolution, and preserve both sides' intent. Never resolve by discarding Trey's uncommitted changes.

### 5.3 Before any branch operation, check

Current branch, clean/dirty tree, upstream tracking (`git branch -vv`), and whether the target commit is already on `origin`. State the answer in your report; do not assume it.

---

## 6. Releases

A release is only done when **Trey explicitly asks**, and **"create a release" means a full GitHub release**, like v1.1.0: published release with the runtime ZIP and its checksum attached, not just a commit and push. Existing authorization carries through the release; do not ask for the same permission repeatedly. Do not infer a release from "ship it" about a code change.

**Do not re-run the test suites for a release.** Trey checks code fully before it is pushed, so release work does not re-test it (this is a stored project preference). State that evidence comes from each change's own checks and list what was not run, as `docs/RELEASE_3.1.2.md` does under "Evidence limits".

Release sequence (details and rationale in working guide section 22):

1. Confirm version, repository identity (`TreyU23/Live-Desktop`), branch, expected working-tree state and the exact commit that will be tagged.
2. Bump the version everywhere it lives (`backend/pom.xml`, `frontend/package.json`, README, `docs/PACKAGES.md`, `scripts/verify-release.ps1`), and write `docs/RELEASE_X.Y.Z.md` (new/fixes/docs/limits/compatibility, and what the change does *not* do).
3. Build the exact artifact: `.\scripts\build-production.ps1`, then `.\scripts\package-production.ps1 -SkipBuild -IncludeJavaRuntime`. `-SkipBuild` runs no tests and reuses artifacts.
4. Write the checksum file (`<hash>  Live-Desktop-windows-x64.zip`, lowercase hex, ASCII).
5. Create the **annotated, signed** tag (`git tag -s`) *after* the ZIP exists. Its message must contain the line `Live-Desktop-windows-x64.zip SHA-256: <hash>`. The publish workflow refuses unsigned, unverified or mismatching tags.
6. Create the GitHub release as a **draft** with both assets, check it, then publish.
7. Fast-forward `main` to the tagged commit (section 5.2). The `publish-runtime-package.yml` workflow then publishes `com.localassistant:live-desktop-windows-x64:<version>:zip` from the attached bytes; it does not rebuild or test.
8. Verify afterwards: tag verification valid on GitHub, assets' digests match local files, ZIP contents (no `data/`, real `.env`, logs, `node_modules`; backend jar version matches), workflow run green. Write `claude/release-X.Y.Z.md` in the Claude project in the same format as earlier records.

Package versions are immutable. Never expose registry credentials or signed download URLs. Report the *actual* security-review status in the release notes.

---

## 7. Security review (required before final output and before any code change is handed back)

Run a targeted review of the exact diff, and a wider look when the change touches a trust boundary. Say which kind you did: a **formal scan** (named tool actually run, on a named snapshot) or a **targeted/static review** (you read the code). A past scan approves only its own snapshot. Never present a read-through as a scan.

Check, at minimum:

- **Credentials and secrets.** No keys, tokens, app-specific passwords or personal data in code, docs, tests, logs, fixtures or commit text. DPAPI (current user) for stored credentials; availability/status returned, never plaintext; iCloud password never echoed to the frontend; OpenAI env-key fallback for the default profile only; real `.env` never committed (only `.env.example`).
- **Network exposure.** Backend and frontend bind to loopback only (`4317` backend, `4173` frontend, `4174` test server). Launch-token and host/Origin checks untouched. No new network origins: no CDN, no Google Fonts, no new web fonts. Outbound destinations validated before credentials are sent (Apple-owned HTTPS only for iCloud).
- **Approval policy.** Reads run immediately; file writes, durable memories, browser launches and device controls need first-use approval for the matching profile and exact scope (exact content for a file, exact text per memory category). Never broaden an approval silently. No "Allow Once" until the backend supports one-shot approvals.
- **Workspace boundaries.** Canonical path checks, symlink/junction escape rejection, 100 KB read cap, 500-entry listing cap, `.env` variants excluded except `.env.example`, profile data directories excluded. Do not claim stronger isolation than exists (no protection against concurrent replacement).
- **Native bridge.** Random named pipe with current-user ACLs, remote clients rejected, connected-PID verified, protocol v1 with allowlisted operations, 16 KiB request and 8 MiB response limits, no replay of mutations with unknown outcome.
- **Frontend hardening.** CSP from `frontend/vite.config.mjs` stays strict (`script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, frames limited to Apple Music and Spotify, plus the Astryx style hashes); music iframe keeps its `sandbox`; no `dangerouslySetInnerHTML`, no `eval`, no unvalidated URLs; no personal data in query strings.
- **Supply chain.** Dependencies pinned exactly (Astryx packages, CLI); `pnpm-lock.yaml` committed and installs use `--frozen-lockfile`; GitHub Actions pinned to commit SHAs; build-only tools in `devDependencies`. Treat a new dependency as a security decision: justify it, pin it, and say so.
- **Profile isolation.** Anything profile-scoped (identity, appearance, conversations, memories, approvals, API keys, integration config, browser prefs) stays scoped via `X-Profile-Id`. Profiles organize data; they are not an authentication boundary between Windows users.
- **Data handling.** Deleting something says exactly what is and is not removed (3.1.2: conversation delete does not remove memories or approvals and is not secure erasure).

Findings: fix what belongs to the current change; for anything else, report it with severity and, if it came from a code review, file it as an issue (section 10). Say so when nothing was found. Do not pad.

---

## 8. Documentation (update all of it, every time)

Treat documentation as part of the change. Before finishing, walk this list and update **everything that the change affects, in the same review**:

| Changed | Update |
| --- | --- |
| Setup, prerequisites, env vars, commands, ports, integrations, security behavior, troubleshooting | root `README.md`, `backend/README.md`, `frontend/README.md`, and `native/README.md` when the native contract changes; remove superseded setup paths instead of keeping alternatives |
| Product purpose, commitments, evidence boundaries | `PRODUCT.md` |
| Visual design, tokens, themes, components | `DESIGN.md`, `frontend/README.md`, `frontend/AGENTS.md` (durable design decisions go here) |
| Tests, validation commands, evidence limits | `docs/VALIDATION.md` |
| Packaging, distribution, release workflow, versions | `docs/PACKAGES.md`, `docs/RELEASE_X.Y.Z.md`, `scripts/verify-release.ps1` |
| Architecture, features, capabilities, project map | `docs/PROJECT-MAP.html`, `docs/SYSTEM_INFORMATION.md`, `docs/WINDOWS_CONTROL_CAPABILITIES.md` |
| Workflow or process rules | this file and `docs/PROJECT-WORKING-GUIDE.md` (bump its version and "Changes in version" note) |

Also:

- Documented commands must match the real scripts. Check by reading the script, not from memory.
- Regenerate the working-guide PDF in `Claude outputs/` when the guide changes. The copy of `Live-Desktop-Project-Working-Guide.pdf` attached to the claude.ai project is an **old version (v1.0, Flight Deck era)**; tell Trey when it needs replacing.
- Durable decisions and release records go to the Claude project (`claude/<name>.md`) via the Projects tool: read the doc, change it, write the full updated content back. Do not write routine scratch there.
- Docs state what is true now. No "TODO" promises as facts, no screenshots of generated readings presented as real telemetry.
- Inspect the **final diff including documentation** before presenting.

---

## 9. Validation and honest reporting

Run the checks that fit the change; do not run everything every time, and do not claim a layer was verified when it was not. Skips are reported separately from passes.

| Layer | Command |
| --- | --- |
| Frontend unit tests | `pnpm --dir frontend test` (`node --test tests/*.test.mjs`) |
| Backend tests | `$env:JAVA_HOME = (Resolve-Path '.tools\jdk-21').Path; .\mvnw.cmd -pl backend test --no-transfer-progress` |
| Native | `.\scripts\build-windows-bridge.ps1`, `.\scripts\test-windows-bridge.ps1`, `.\scripts\test-native-host.ps1` |
| Full production build (native CTest, backend, frontend unit, Vite/Sites, runtime extraction, CDS) | `.\scripts\build-production.ps1`, or `build.cmd` from the repo root (`build.cmd run` stops, rebuilds, starts) |
| Production startup/lifecycle | `.\scripts\test-production-startup.ps1` (stop dev and production instances first; free ports 4173 and 4317 without killing unrelated listeners) |
| Browser regression | start `pnpm --dir frontend dev -- --host 127.0.0.1 --port 4174 --strictPort`, then `node frontend/tests/browser-redesign.mjs`, `browser-mutation-races.mjs`, `pnpm --dir frontend test:browser` (performance), `test:contrast`, `test:privacy` as the change warrants |
| Sites handoff | `pnpm --dir frontend build` then `pnpm --dir frontend test:sites` |
| Astryx build check | `pnpm exec astryx doctor --built dist/client` (from `frontend/`) |

Report with these categories, and say which apply: inspected in source; compiled; unit tested; exercised by mocked browser tests; exercised through the real runtime; validated from the packaged artifact; manually verified with real accounts or hardware; published and verified after publication. Automated checks do **not** establish authenticated OpenAI behavior, real iCloud behavior, real Apple Music/Spotify audio, Phone Link, physical radio changes, sleep/resume, multi-user isolation, screen readers or real browser zoom. The browser suites use mocked integrations and synthetic data. Never write "tested" for any of those.

Performance claims need comparable measurements (same workload and artifact; cumulative startup milestones are not added together). Store generated screenshots and logs under ignored `backend/target/`.

If a previous answer or change of yours turns out wrong, say so plainly, explain why, and give the correction.

---

## 10. Code reviews and issues

After **every** code review, create a GitHub issue on the reviewed repository **for each problem found** (standing instruction, applies to all future reviews). One issue per problem, no grouping, no skipping minor ones. A review covers architecture, command/lifecycle and scheduling behavior, concurrency, state handling, maintainability, naming, hidden bugs and runtime behavior, not just syntax; explain why each finding matters.

Use the format of the existing review issues (for example #24):

```
**Severity:** Low | Medium | High | Critical
**Category:** design | correctness | security | performance | docs | ...
**Status:** Confirmed | Suspected
**Review ID:** <as in earlier reviews, e.g. L11>

Found in <what was reviewed: release tag / commit / branch>.

### Where
- `path/to/file:line-range`

### What's wrong
...

### Failure scenario
Concrete inputs/state -> wrong behavior.

### Suggested fix
...

_Fix status:_ Not fixed / Fixed in <commit> / ...
```

Title: a plain statement of the defect. Mark `Suspected` instead of `Confirmed` when you could not verify. Check the existing open issues first so you do not file a duplicate. Filing is not fixing: do not start fixing unrequested findings. When a fix lands later, update the issue's fix status.

---

## 11. Code standards

- **Complete output.** Full files or full methods. No placeholders, no "rest unchanged" gaps, no stub code. Production quality.
- **Java.** Keep `kSomething` constant naming. If a linter objects, suppress only that specific warning; do not rename constants or disable other diagnostics. Respect the existing bounded-behavior contracts in `backend/README.md` (bridge budget 15 s, caches, client limits, bounded tool rounds); never replace a bounded cache or network call with an unbounded one. Do not assume streaming exists.
- **Frontend state.** APIs, profiles and mutations live in `App.jsx`; views own presentation and drafts only. **One resource scheduler**: one in-flight read per resource, 12 s deadline, profile identity captured, aborted on teardown, reads invalidated around mutations, stale responses never overwrite confirmed writes, hidden documents pause polling. Views never start their own polling loops. Failed submissions keep drafts; successful saves clear them. Never turn a missing reading into zero or "healthy": show it as unavailable.
- **Mutations of unknown outcome** are never replayed automatically; query current state first.
- **Product claims.** No voice input, calendar editing or unsupported playback. Label anything that leaves the app (opens a Windows app) as external. Opening Windows Settings does not confirm a toggle changed. Imagery follows actual metadata (iPhone/Android/neutral). The workstation artwork is generic, not a detected model.
- **Integrations.** No extra paid developer program or paid API for dashboard features. Apple Music and Spotify need no developer credentials. iCloud uses an app-specific password under DPAPI, read-only agenda.
- **Sites handoff.** Keep `frontend/.openai/hosting.json`, `frontend/worker/index.js`, `frontend/scripts/prepare-sites-build.mjs` and `frontend/tests/sites-worker.test.mjs` intact. The build must leave `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`.
- **Windows scripts.** `.\scripts\*.ps1` are the intended entry points. Production startup must not build, extract, train CDS or download anything. Use `run-backend.ps1` / `run-frontend.ps1` for development, in separate terminals, and stop them before starting production.
- **Never** terminate a process just because it occupies a port; identify it first.
- **Rollback.** No feature flags. Rollback granularity is the commit, which is why commits stay atomic.

---

## 12. Design: the Astryx design system

All UI work uses **Astryx** (`@astryxdesign/core` with the neutral theme, currently v0.7.16, pinned exactly) as implemented on 15 Nov 2026 and released as 3.0.0. It replaced the never-released Apple-style glass design (version 2) and the earlier Flight Deck design. Where `frontend/AGENTS.md` still describes glass or Flight Deck (true-black `#000000` canvas, cobalt accents, 10/16/24 px radii, glow, pill buttons), **those bullets are superseded**; Astryx governs. The reference documents are `DESIGN.md`, `claude/astryx-redesign-plan.md` in the Claude project, and the sandbox rules in `C:\Users\treyu\Personal Code\astryx-sandbox\AGENTS.md`. Follow those rules strictly; break one only when clearly necessary and tell Trey afterwards which rule and why.

### 12.1 Before building

Give Trey a **short plan** (layout, template, theme choices) in a few lines, then build without waiting for approval. Check for a matching template first:

1. `pnpm exec astryx build "<idea>"` to get the template and the parts it lacks (run from `frontend/`).
2. `pnpm exec astryx template <name> <path>` to scaffold; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for missing parts; `astryx component <Name>` to read props before using a component.
4. Changing an existing page: skip scaffolding and add components inside its sections. `astryx docs layout` before changing a template's frame.
5. `astryx search "<query>"` finds components, hooks, docs and templates; `astryx docs <topic>` for tokens, theme and styling.

### 12.2 Rules

- **No raw `<div>` or `<span>`.** Components handle layout and spacing.
- **Style order:** component props first, then tokens (`var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`). No raw hex, no raw px, no imported project `.css`/`@apply`, no `xstyle`/utility classes, no StyleX or Tailwind compiler.
- **Dense data is rows** (`Table`, `List`/`Item`), not Card-wrapped lists. Cards only for the three Overview instrument tiles. `Badge` is for counts only (the pending-approvals count); state uses `StatusDot` plus text.
- **Sanctioned exceptions:** `ResourceGauge` and `Sparkline` stay bespoke SVG (Astryx has no gauge) with token colors only; the provider iframe lives in `MusicFrame` with token-based inline style.
- **Severity colors** use `--color-icon-success`, `--color-icon-warning`, `--color-icon-error`; plain `--color-warning` fails 3:1 on light cards. Thresholds: `<75` normal, `75-89` warning, `>=90` error.
- **Themes.** Colors, fonts, corners and spacing go through the theme, never `:root` overrides and never runtime `:root` writes. Themes are `live-desktop` (neutral base, Segoe UI Variable via the theme editor, **no web fonts**) plus four built preset accents (`live-desktop-blue`, `-green`, `-orange`, `-red`) in `frontend/themes/`, switched with `<Theme theme={...}>`. Neutral's default accent is monochrome. Saved custom hex values map to the nearest preset; do not add a runtime `defineTheme` (it injects a `<style>` and weakens the CSP).
- **Theme workflow.** `astryx experimental theme editor new <name> --like neutral`, then `editor set <name> <thing> <value>` (or `editor how "<what you want>"`), wire with `astryx theme add <name>`, and look at the output with `editor show <name> --png`. **A theme change is not done until you have opened and looked at the PNGs.** Do not wire `theme-neutral/fonts.css` (it imports Google Fonts). Theme PNG/preview files are git-ignored.
- **Appearance** is Light / Dark / System via `<Theme mode>`, saved per profile. Everything must be checked in both modes.
- **Icons:** Feather (`react-icons/fi`) through `Icon`.
- **Radii** are neutral's 6/10/12 px tokens; no pills, no glow, no glossy tiles, no chat bubbles, no glass or wallpaper, no "Reduce transparency".
- **Approvals UI:** inline **Don't Allow / Allow**, expandable row with full content and reusable scope, so nothing is allowed unseen; the approval dialog states the reusable scope and, for radios, that it covers both on and off.
- **Responsive:** `AppShell` + `SideNav`; below 768 px the nav becomes the mobile drawer (`MobileNav`) exposing all seven views, the lifecycle controls and the profile menu. Shutdown/restart keep their confirmation (`AlertDialog`); destructive confirmations contain keyboard focus, allow cancel and restore focus.

### 12.3 View-to-template map

| View | Template | Main components |
| --- | --- | --- |
| Shell | `shell-side-nav` | `AppShell`, `SideNav`, `MobileNav`, `Toast`, `AlertDialog`, profile `MoreMenu` |
| Overview | `dashboard` | `Grid` of `Card` instrument tiles, `Banner`, `List`/`Item`, `MetadataList`, `Switch`, `Table` |
| System Info | `detail-page` | `SegmentedControl`, `ProgressBar`, `Table`, `MetadataList` |
| Conversations | `ai-chat` | `Chat`, `List`, `TextArea`, `Dialog` (approval sheet), `AlertDialog` (delete) |
| Approvals | `table-page` | `TabList`, `Table`, `StatusDot`, `Banner` |
| Memories | `table-filter` | `TextInput`, `Table`, `IconButton`, `AlertDialog`, `Dialog` (add) |
| Settings | `settings-sidebar` | `FormLayout`, `Field`, `SegmentedControl`, `Switch`, `Button` |
| Music | `blank` | `Card`, `Stack`, `IconButton`, `ProgressBar`; iframe untouched |

### 12.4 Before calling design work done

1. **Self-check every touched file:** re-read it and replace any raw `<div>`/`<span>`, imported `.css`, or hardcoded hex/px with a component or token.
2. **Look at the real render** (run the dev server and open it yourself; do not hand Trey start-up instructions). Check **light and dark**, at 1440 and 390 px minimum; the regression suite covers 1920, 1440, 1280, 768, 390 and 320.
3. `pnpm exec astryx doctor --built dist/client` on real builds; do not deliver a build that fails. Two **pre-existing** doctor problems are known: `src/astryx-themes.js` differs from its generated version, and theme font stylesheets are not imported (intentional, local system fonts). Do not report these as new, and do not hide any additional ones.
4. Run the relevant browser checks (`browser-redesign`, `browser-contrast`, `browser-privacy`, axe where touched) and report them as mocked-browser evidence.
5. Remember the open item: Astryx's default buttons render about 32 px tall, below the old 44 px target rule; touch-size on a real device is unmeasured. Do not claim 44 px targets.
6. Record durable design decisions in `frontend/AGENTS.md` and `DESIGN.md`.

### 12.5 Upgrades

Astryx packages are pinned exactly. After any bump: `pnpm exec astryx upgrade --from <old version> --apply`, rebuild, re-run the browser suites, and **recompute the CSP hashes** in `frontend/vite.config.mjs` for the two stylesheets Astryx injects (Layer position-try rules, CodeBlock syntax map); `browser-redesign.mjs` fails on any CSP violation. Refresh the managed ASTRYX block in `frontend/AGENTS.md` with the CLI; do not hand-edit between its markers.

---

## 13. Reporting back

Lead with the result, then only the decisions and problems that matter. No step-by-step replay. Keep confirmed facts, well-supported conclusions and speculation separate when the difference changes what Trey does. If you could not run, see or verify something, say so in that report.

A good review prompt reads like: *what changed, why; which files; what ran, passed, skipped; docs updated; security review status; `git add` paths and a suggested message; "ready for your review"*.

---

## 14. Quick reference

- Working branch: `Development`. Released line: `main`, fast-forward only. Tags `vX.Y.Z`, annotated and signed.
- Agents do not commit/tag/push/merge code. One review prompt per problem. Trey commits.
- Signed commits only (SSH signing, Verified on GitHub). Cloud-made commits are not pushed; use patches.
- Release only on explicit request; full GitHub release with ZIP and checksum; do not re-run tests for release.
- Review security and update all docs before final output.
- One GitHub issue per problem found in any code review.
- Astryx only: templates first, no raw `div`/`span`, props then tokens, theme editor with PNG review, light and dark, `astryx doctor --built dist/client`.
- Never present missing data as zero, never broaden an approval, never expose a credential.
