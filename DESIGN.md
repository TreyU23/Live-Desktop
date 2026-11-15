---
name: Live Desktop — Astryx
description: A local Windows dashboard with PC telemetry first, built from Astryx components on a neutral-based theme.
system:
  package: "@astryxdesign/core 0.7.16 (pinned)"
  base-theme: "@astryxdesign/theme-neutral 0.7.16 (monochrome accent)"
  local-themes: "live-desktop (default), live-desktop-blue, live-desktop-green, live-desktop-orange, live-desktop-red"
  theme-sources: "frontend/themes/<slug>/ (theme editor) → frontend/src/themes/<slug>/ (astryx theme add)"
  registry: "frontend/src/astryx-themes.js (generated)"
typography:
  body: "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
  heading: "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
  web-fonts: "none (theme-neutral/fonts.css is a Google Fonts import and is never wired)"
rounded:
  inner: "var(--radius-inner) 6px"
  element: "var(--radius-element) 10px"
  container: "var(--radius-container) 12px"
accent-presets:
  neutral: "theme default; --color-accent is near-black in light mode and near-white in dark mode"
  blue: "#0074e2"
  green: "#198100"
  orange: "#c4650f (darkened from #d57113 on 2026-11-15 so it keeps 3:1 on the light background)"
  red: "#d62830"
severity:
  thresholds: "<75 normal · 75–89 high · ≥90 critical (presentation/utilizationSeverity.js)"
  instrument-tokens: "--color-icon-success / --color-icon-warning / --color-icon-error"
  component-variants: "StatusDot, ProgressBar and Banner use success / warning / error"
---

# Live Desktop design system (Astryx)

The UI is built from [Astryx](https://github.com/meta/astryx) components on a local theme derived from `neutral`. Astryx's own stylesheets plus the theme CSS are the only CSS in the app; there is no project stylesheet. Conventions live in `frontend/AGENTS.md` (the `astryx init` block) and the plan that drove the migration is the project doc `claude/astryx-redesign-plan.md`. [Product](PRODUCT.md), [selected reference](docs/redesign/README.md).

## Rules

- Start from a template, compose components, and style with component props first, then tokens (`var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`). No raw `div`/`span`, no imported `.css`, no hard-coded hex or px in `frontend/src/`.
- **Sanctioned exceptions**, each commented where it lives:
  - `components/instruments/ResourceGauge.jsx` and `Sparkline.jsx` are bespoke SVG (Astryx has no gauge or sparkline). They draw with token colors only and have no stylesheet.
  - `components/media/MusicFrame.jsx` keeps the provider `<iframe>` and parks it with an inline style built from tokens, so playback survives navigation.
  - Media-query strings (`useMediaQuery('(min-width: 1024px)')`) carry breakpoint px values.
  - Feather icons (`react-icons/fi`, mapped in `components/ui/icons.js`) are passed to Astryx `Icon` (decision 7).
- Palettes and accents go through themes, never `:root` overrides. Change a theme with the theme editor (`pnpm exec astryx experimental theme editor set <slug> …`), look at its PNGs (`… show <slug> --png`), then `pnpm exec astryx theme add <slug>`.
- Dense data are rows (`Table`, `List`/`ListItem`, `MetadataList`), not Card-wrapped lists. `Card` is used only for the three Overview instrument tiles and the Music player. `Badge` is for counts only (the pending-approval count); state is `StatusDot` plus text.

## Appearance

`<Theme theme={themes[preset.theme]} mode={appearance}>` wraps the app. Appearance is Light, Dark or System and is saved per profile; the accent is one of five presets, each a built theme, also per profile. A hex accent saved by the old glass UI is mapped to the nearest preset by hue (greys, black and white become Neutral). Reduce transparency was removed with the glass shell; its stored key is cleared on load.

`frontend/tests/browser-contrast.mjs` resolves the live tokens in a browser for both modes and every preset and checks 4.5:1 for text pairs and 3:1 for the instrument severity colors and the accent. Plain `--color-warning` is only about 1.5:1 on a light card, which is why the SVG instruments use the `--color-icon-*` tokens.

## Layout

`AppShell` with `SideNav` (Desktop: Overview, System Info · Assistant: Conversations, Approvals with the pending `Badge`, Memories · Media: Music · Live Desktop: Settings) and the profile menu in the footer; below 768px the navigation moves into the AppShell drawer. Every view renders through `components/shell/Page.jsx`: title, detail and the shared actions (local status, **Restart Live Desktop**, **Stop Live Desktop**) beside the title from 1024px, wrapped under it below. `Page` takes an optional `start` panel (Conversations' thread list). Views and the parked music frame share one auto-height column so each page sizes to its content.

| View | Structure |
| --- | --- |
| Overview | Three instrument Cards (gauge, `StatusDot` severity label, 15-minute sparkline) · warning `Banner` with **Review requests** when actions are pending · This PC (`MetadataList`) beside Controls (`Switch` rows for Wi-Fi/Bluetooth; launcher `Button`s with an external icon under “These open Windows Settings…”) · Ask Live Desktop (`TextInput`, **Send**, suggestion buttons that only fill the field) · Calendar, Now playing, Phone · Connections and Recent activity `Table`s. Each service keeps its own `ResourceBoundary` (Spinner, warning/error `Banner` with retry, stale data kept visible). |
| System Info | `SegmentedControl` Live / Specifications and **Copy specifications**. Live: Resources as severity `ProgressBar`s, Activity `Table` with sparklines, Device and Windows `MetadataList`s. Specifications: full device, Windows and live-status lists. IDs stay hidden until **Show IDs**. |
| Conversations | Threads in a `LayoutPanel` (a `Selector` below 768px), `ChatLayout`/`ChatMessageList`/`ChatMessageBubble` (assistant messages as ghost bubbles), `ChatComposer` with no dictation, **Review requests** with the pending count. |
| Approval dialog | `Dialog`: “Request n of m” with paging, “Allow Live Desktop to …?”, Action/How/Requested, content in a `CodeBlock`, the reusable-scope `Banner`, **Decide later**, **Don’t Allow**, **Allow**. Escape decides nothing and focus returns to the composer. |
| Approvals | `TabList` Pending (with count) / History, info `Banner`, `Table` with inline **Don’t Allow** / **Allow** and an expandable row showing operation, target, reusable scope and the full content. |
| Memories | Search `TextInput`, count, **Add memory** (form `Dialog`), `Table` with delete `IconButton` behind an `AlertDialog`. |
| Music | Provider `SegmentedControl`, **Music settings**, external open, the player in a `Card`, then the persistent provider frame. |
| Settings | Section list beside `SettingSection`/`SettingRow` groups: Profile, Appearance (Theme, Accent), Assistant, Connections, Live Desktop services. |

## Instruments and truthfulness

Gauges are 240° open-bottom arcs with round ends (`role="meter"`, `aria-valuetext` names the severity). Only finite 0–100 readings get a fill; 0 draws no fill, 100 fills the sweep, a missing reading shows an em dash and the tile says Unavailable. System Info bars follow the same rule: a missing reading draws no bar. Sparklines show App-buffered samples for about 15 minutes; fewer than two points draw a dashed baseline. Severity never follows the accent.

Direct radio switches request a change that runs only after approval (their accessible name says “Request on/off”); Settings launchers are labelled external. Calendar, music and Phone Link external opens say “externally”. Phone artwork follows the linked platform (iPhone, Android or none). Restart/Stop act on Live Desktop's services, never Windows. Voice input and calendar editing are absent. Synthetic fixtures never become production telemetry. [Validation](docs/VALIDATION.md).
