---
name: Live Desktop — Glass
description: A local Windows dashboard with PC telemetry first, in an Apple-style glass shell.
colors:
  page: "#0B0B0C"
  wallpaper-blue: "#121C33"
  wallpaper-grey: "#1F1F22"
  glass: "linear-gradient(180deg, rgba(48,48,54,.70), rgba(30,30,34,.78))"
  glass-strong: "linear-gradient(180deg, rgba(50,50,58,.86), rgba(30,30,36,.92))"
  hairline: "rgba(255,255,255,.10)"
  well: "rgba(0,0,0,.30)"
  text: "#F5F5F7"
  text-secondary: "#E5E5EA"
  muted: "#98989F"
  accent: "#0A84FF"
  accent-readable: "#3B9DFF"
  accent-fill: "#0970D9"
  ready: "#30D158"
  attention: "#FF9F0A"
  error: "#FF6961"
  reduced-transparency-page: "#000000"
  reduced-transparency-surface: "#1C1C1E"
  light-page: "#F2F2F7"
  light-glass: "linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.58))"
  light-text: "#1D1D1F"
  light-muted: "#636366"
  light-ready: "#17733A"
  light-attention: "#8A5100"
  light-error: "#C01F2E"
typography:
  ui:
    fontFamily: "'SF Pro Text', -apple-system, 'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  display:
    fontFamily: "'SF Pro Display', -apple-system, 'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', sans-serif"
  page-title:
    fontSize: "clamp(24px, 2.2vw, 28px)"
    fontWeight: 700
    letterSpacing: "-.02em"
  card-title:
    fontSize: "15px"
    fontWeight: 600
  prose:
    fontSize: "16px"
    lineHeight: 1.6
  measurement:
    fontFamily: "Consolas, ui-monospace, monospace"
  instrument:
    fontSize: "clamp(26px, 2.4vw, 34px)"
    fontWeight: 600
rounded:
  nav: "10px"
  group: "16px"
  card: "24px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
components:
  card: "glass fill, 1px hairline, specular top edge, elevation-1, 24px radius, 20px padding"
  card-strong: "glass-strong fill, backdrop blur 44px — overlays only (sidebar popovers, menus, dialogs, approval sheet, toasts)"
  group: "recessed inset list, well fill, 16px radius, 44–56px rows split by hairlines"
  btn-pill: "default button: translucent gradient pill, hairline, 44px min height"
  btn-primary: "accent-fill with accent-fill-ink text (white on the default blue, ≥4.5:1)"
  btn-icon: "44px circle"
  segmented: "pill track; selected segment raised"
  tile: "fixed-color rounded square with gloss; navigation and settings rows"
  control-tile: "direct radio switch (role=switch); accent tint when on"
  launcher-tile: "opens Windows Settings; never presented as a toggle"
---

# Live Desktop glass design system

`frontend/src/styles/tokens.css` is the runtime authority; `frontend/tests/tokens.test.mjs` checks every text color against the glass it sits on. Frontmatter records palette, typography and component roles. [Product](PRODUCT.md), [selected reference](docs/redesign/README.md).

## Visual contract

- Near-black `#0B0B0C` canvas with a static wallpaper (blue top-left, grey bottom-right radial gradients) and a faint ambient glow. Content sits on translucent glass cards. Never animate the wallpaper or glow.
- Reduced transparency is a first-class mode: the system preference (`prefers-reduced-transparency`, also `prefers-contrast: more`) or Settings → Appearance → Reduce transparency switches to true black `#000000`, solid `#1C1C1E` surfaces (white `#FFFFFF` on `#F2F2F7` in light mode), and no wallpaper, glow or backdrop blur.
- Segoe UI Variable is the production face on Windows (the SF entries in the stack only apply if the UI is viewed on a Mac; no web fonts are loaded). Consolas for code and measurements; tabular numerals. Body 14px, prose/memories 15–16px, card titles 15px, page titles 24–28px.
- Radii: 10px navigation items and fields, 16px inset groups, 24px cards (20px on phones), 999px pill buttons and chips. Standard targets are at least 44px high. Focus uses a 2px readable-accent outline with 4px offset plus a dark (light-mode: white) halo so it stays visible on glass.
- Mint/amber/red convey ready/pending/error alongside text, and the same tokens color utilization severity on gauges/bars (`<75` ready, `75–89` attention, `≥90` error). Severity never follows the accent.
- Preserve saved accents. App.jsx derives `--accent-readable` (same hue, lightened/darkened to 4.5:1 on the glass surface), `--accent-fill` (darkened until white text passes 4.5:1; very light accents keep their fill with black text) and `--accent-soft`. A saved Black accent renders as white in dark mode.
- Explicitly imported Feather outline icons (`react-icons/fi`), normally 16–20px. Navigation tiles use fixed colors, not the accent, so navigation stays legible with any accent. Color/background/border transitions last 150ms; reduced motion disables animation/transitions and the gauge glow.
- Backdrop blur is only used on overlays that sit above live content (`.card--strong`). Cards over the static wallpaper are translucent gradients without blur: blurring a smooth gradient changes nothing visible and costs a compositor sample per frame. The scrolling view region is its own compositor layer (`will-change: scroll-position`); `browser-performance.mjs` enforces a 60 fps scroll budget on Overview.
- Views compose the material classes in `components.css` (`.card`, `.card--strong`, `.group`, `.btn-*`, `.segmented`, `.pill-input`, `.tile`, `.control-tile`, `.launcher-tile`, `.switch`); they never restyle materials themselves.

## Layout and interaction

A floating glass sidebar (248px; 220px below 1200px) holds the brand, a page search that filters navigation labels locally, grouped navigation (Desktop: Overview, System Info · Assistant: Conversations, Approvals with pending badge, Memories · Media: Music · Live Desktop: Settings) and the profile button. Each view renders its own header: title, detail and the shared page actions (local-status pill, restart and shut down Live Desktop). Only the view region scrolls. Content max-width: 1760px.

Overview is a four-column widget grid: Performance (3 columns: CPU, memory, storage gauges with sparklines), PC (identity, network, throughput, disk activity, battery), Controls (2: direct Wi-Fi/Bluetooth switches, Windows Settings launchers under an explicit caption, pending-approval banner), Calendar, Now Playing, Ask Live Desktop (2: pill composer, suggestion chips that only fill the field), Phone, Connections, Recent activity (2). Each service keeps its own resource boundary so loading/stale/error/retry render in place. Below 1100px cards span the full two-column width; below 768px one column ordered instruments, controls, PC, then services.

System Info uses a Live / Specifications segmented control: Live shows the generic workstation art, identity and summary group, resource bars with sparklines and network/disk tiles; Specifications shows device, Windows and live-status groups, with device and product IDs hidden until **Show IDs**. Conversations is a Messages-style layout: thread list (selected thread in accent fill), chat card with bubbles (user right in accent fill, assistant left), pill composer that preserves drafts. Settings is a single 720px column of grouped rows: profile card, Appearance (Light/Dark radiogroup, Reduce transparency, accent swatches, custom hex), Assistant (OpenAI key, remembered approvals), Connections (iCloud Calendar with the form opening inline, music service, Phone Link), Live Desktop services (restart, shut down — these stop Live Desktop, never Windows).

Below 768px the sidebar becomes a bottom tab bar: Overview, System Info, Conversations, More (Music, Approvals, Memories, Settings and the pending count; `aria-expanded`, Escape closes) and the profile avatar. Preserve seven view IDs, lifecycle/profile access and `aria-current` on the selected item.

Approval sheet: when a pending action appears while Conversations is open, a modal glass sheet shows it with a queue position, Action / How (“Direct change by Live Desktop” vs “Opens Windows Settings”) / Requested, literal content as text, and the reusable-scope notice. Buttons are **Don’t Allow** and **Allow**; the backend has no one-shot approval, so the sheet states that allowing also allows matching requests later instead of offering a switch. Escape or **Decide later** closes without deciding and returns focus to the composer; **Review requests** in the chat header reopens it. The Approvals view remains the full queue and history.

Destructive confirmations contain focus, allow cancellation and restore focus. Fields retain visible (or visually hidden) labels and errors. Primary actions use the accent fill; secondary actions are glass pills; destructive actions use the error color. Status labels remain text; the amber pending badge is the only filled status.

## Instruments and truthfulness

Gauges share 240-degree open-bottom arcs, nine-unit round-ended strokes and a translucent track; a blurred copy of the fill in the same severity color sits behind it as glow (off under reduced transparency or reduced motion, never animated). Labels sit above, values inside, details below. Only finite 0–100 readings get percentages/fill; zero has no active stroke, 100 fills the sweep, unavailable values show a dash. Fill color follows utilization severity rather than accent. Bars use recessed eight-pixel tracks with the same severity coloring. Compact sparklines under instruments and on the System Info network/disk tiles show the last ~15 minutes of App-buffered samples; fewer than two finite points stay empty. Local graphite workstation art (System Info) and the Overview device tile are generic, not detected hardware.

Calendar and music empty states may offer one-click **externally** launches (Windows Calendar / provider app or HTTPS fallback) through approval-gated actions. Distinguish direct Wi-Fi/Bluetooth from Open Settings actions. Phone artwork follows available platform metadata; unknowns stay unknown. Provider availability never comes from decorative colors. Voice input/calendar editing are absent. Synthetic imagery/fixtures never become production telemetry. [Validation](docs/VALIDATION.md).
