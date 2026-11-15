# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Current visual direction

- Astryx redesign implemented November 15, 2026 from the user's plan (project doc `claude/astryx-redesign-plan.md`) and concept screens; it supersedes the glass and Flight Deck bullets below wherever they conflict. See `../DESIGN.md`. Astryx components on the local `live-desktop` theme (neutral + Segoe UI Variable, no web fonts); four preset accents as built themes; Light/Dark/System per profile. No project stylesheet, no glass, no Reduce transparency. Follow the ASTRYX block at the end of this file.
- Sanctioned exceptions to "no raw elements": the SVG `ResourceGauge` and `Sparkline` (token colors only) and the provider iframe in `MusicFrame`. Instruments use `--color-icon-success/warning/error` because plain `--color-warning` fails 3:1 on light cards.
- Approvals: inline **Don’t Allow / Allow** plus an expandable row with full content and reusable scope. Memories keeps **Add memory** in a dialog. Both differ from the concepts on purpose and were reported to the user.
- The built app ships a CSP (`vite.config.mjs`); any new inline `<style>` from an Astryx upgrade needs its hash added there. The provider iframe is sandboxed.

Glass history (November 14, 2026; superseded by Astryx):

- Apple-style glass shell implemented November 14, 2026 and authorized by the user: near-black `#0B0B0C` wallpaper with glass cards, floating sidebar (bottom tab bar below 768px), restart/shut down in each view's header and in Settings, radii 10/16/24/999px, severity-tinted gauge glow, Reduce transparency. Backdrop blur only on overlays.
- Approval sheet says **Allow** plus a reusable-scope notice; do not add “Allow Once” until the backend supports one-shot approvals. (Still current.)

Flight Deck history (superseded where it conflicts with the Astryx direction):


- V2 refinement authorized November 2, 2026: preserve Flight Deck composition, use Segoe UI Variable, 10px controls, 14px containing surfaces, consistent outline icons, 240-degree open-bottom gauges with actual percentage fills, and a modest graphite workstation illustration. Keep true-black canvas; artwork is generic rather than detected hardware.
- Utilization severity on gauges/bars reuses mint/amber/rose (`<75` / `75–89` / `≥90`). Overview keeps ephemeral ~15-minute sparklines from the App system series buffer (cap 60) plus network/disk activity rates from `/api/system`. Calendar/music empty states expose approval-gated external open actions; label leaves as external.

- Use the Flight Deck redesign in `../DESIGN.md`: PC overview first, instruments centered, controls left, connected services right, and reserved bottom navigation. The user authorized implementing the existing plan on November 1, 2026.
- Below 768 px, instruments precede controls and services; navigation exposes Overview, System Info, Conversations and More. More contains Music, Approvals, Memories and Settings. Preserve all seven view IDs.
- Keep one resource scheduler in App, mutation invalidation, profile request headers, and the persistent provider iframe. Views own presentation and drafts, never independent polling loops.
- Missing readings are unavailable, not zero. Approval details explain reusable scope, including both on and off for radios. Do not add voice input, calendar editing, or unsupported playback features.
- The application background is true black (`#000000`), never charcoal, navy, or a gradient.
- Use near-black raised surfaces, subtle separators, warm-white text, cobalt-blue controls, mint health states, and amber approvals.
- Preserve airy spacing and avoid a dense wall of bordered cards.
- Dashboard widgets must respond inside Live Desktop first; any action that opens a Windows app must be explicitly labeled as external.
- Keep frontend/backend restart and shutdown controls visible in the top bar, with a confirmation step for shutdown.
- Phone Link status should refresh automatically and on demand, using live local metadata instead of hardcoded notification or device details.
- The Phone Link illustration must reflect the linked platform: iPhone for Apple/iOS metadata, Android for Android metadata, and a neutral placeholder when the platform is unknown.
- Settings owns account connections and appearance preferences; true-black dark mode is the default, and theme plus preset/custom hex accent colors persist locally per profile. The Black accent renders as white in dark mode for contrast and as black in light mode.
- The top-bar profile icon opens a local profile picker. Profile identity, appearance, conversations, memories, approvals, API keys, and integration configuration must remain isolated by profile and stored only on this PC.
- The dashboard widget and full-window Music view use the original compact custom player design for either Apple Music or Spotify: album art, real track metadata, progress, and playback controls.
- Extra dashboard integrations must not require an additional paid developer program or paid API. Prefer local Windows capabilities and user-owned services.
- Settings owns a profile-scoped Apple Music/Spotify provider toggle. Keep one persistent embed for the selected provider, retain separate provider links for seamless switching, and use Windows Global System Media Transport Controls for real metadata and playback commands. Neither provider may require developer credentials; Apple Music must not request MusicKit credentials, a Team ID, Key ID, `.p8` key, or Apple Developer Program enrollment, and Spotify must not request an OAuth client or developer application.
- Preserve the compact calendar widget layout, but source its events from the user's iCloud Calendar through the local backend. iCloud credentials must use an Apple app-specific password, be protected with Windows DPAPI, and never be echoed back to the frontend.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

<!-- ASTRYX:START -->
Astryx v0.7.16 · 174 components
CLI: run every command as `pnpm exec astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for parts it lacks; `astryx component <Name>` to read props before using one.
Changing an existing page? Keep it: skip step 2 and add blocks/components inside its sections.
Before you deliver a build, run `astryx doctor --built <dir>`; don't deliver it if it fails.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then tokens (var(--color-*|--spacing-*|--radius-*)). No raw hex/px. No StyleX/Tailwind compiler here — don't use xstyle/utility classes directly. Some templates use StyleX and need a compiler plugin; see `astryx docs styling-overview`.
- THEMES: palettes and custom colors go through the theme, never :root overrides. To make or change a theme (colors, fonts, corners, spacing, a look from a picture), prefer the experimental theme editor over hand-written theme files: `astryx experimental theme editor new <name> --like neutral`, then `editor set <name> <thing> <value>` or `editor how "<what you want>"`; wire it with `astryx theme add <name>`; after each change look at it with `astryx experimental theme editor show <name> --png` and open the PNGs it writes (changes nothing in the app); a theme change is not done until you have looked at the pictures. In code, extend an imported theme to customize it; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or a token.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands and API reference
  docs authoring     build an integration package, and every field it holds
  upgrade --from <old version> --apply   run after a dependency bump
<!-- ASTRYX:END -->
