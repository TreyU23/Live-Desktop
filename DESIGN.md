---
name: Live Desktop — Flight Deck
description: A precise local Windows dashboard with PC telemetry at its center.
colors:
  page: "#000000"
  surface: "#0d1117"
  surface-hover: "#111923"
  line: "#303943"
  line-strong: "#657586"
  text: "#f1f4f6"
  muted: "#a0adb9"
  accent: "#4a9aff"
  accent-soft: "#0a2038"
  ready: "#85d9bd"
  attention: "#ffc56d"
  error: "#ff8589"
  light-page: "#f5f7fa"
  light-surface: "#fff"
  light-surface-hover: "#e8eef5"
  light-line: "#bbc6d1"
  light-line-strong: "#68798c"
  light-text: "#132334"
  light-muted: "#485d71"
  light-ready: "#12614b"
  light-attention: "#7c4a00"
  light-error: "#b32035"
  readable-accent-dark-fallback: "#A8CCFF"
  readable-accent-light-fallback: "#174C8C"
typography:
  headline:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "clamp(24px, 2.2vw, 30px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-.02em"
  title:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  prose:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "16px"
    lineHeight: 1.75
  label:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: ".06em"
  measurement:
    fontFamily: "Consolas, monospace"
  instrument:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', sans-serif"
    fontSize: "clamp(24px, 3vw, 42px)"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  square: "0"
  control: "10px"
  dialog: "14px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "6px 0"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  field:
    backgroundColor: "{colors.page}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "8px"
  state-completed:
    textColor: "{colors.ready}"
  settings-container:
    rounded: "{rounded.square}"
    padding: "32px 0"
  resource-gauge:
    textColor: "{colors.text}"
    typography: "{typography.instrument}"
    width: "min(100%, 190px)"
  resource-bar:
    textColor: "{colors.text}"
    typography: "{typography.measurement}"
---

# Flight Deck design system

CSS in `frontend/src/styles/` is the runtime authority; frontmatter records palette, typography and component roles. [Product](PRODUCT.md), [selected reference](docs/redesign/README.md).

## Visual contract

- Preserve the implemented composition: true-black canvas, graphite surfaces, blue PC instruments, controls left, services right, reserved header/dock. Refine in place.
- Segoe UI Variable/Segoe UI for headings/body; Consolas for code/measurements; tabular numerals. Body 14px, prose/memories 16px, titles 18px, page titles 24–30px.
- Controls/navigation use 10px corners; containing surfaces/overlays 14px. Structure text rows with spacing/rules. Standard targets are at least 44px high; focus uses a 2px readable-accent outline with 4px offset.
- Default page `#000000`, surface `#0d1117`, text `#f1f4f6`, accent `#4a9aff`. Mint/amber/rose convey ready/pending/error alongside text, and the same tokens color utilization severity on gauges/bars (`<75` ready, `75–89` attention, `≥90` error). Light mode has separate tokens.
- Preserve saved accents; derive readable text/focus colors and fill foreground. Black becomes white in dark mode. Runtime soft accent uses 16% opacity; semantic status colors remain independent of the chosen accent (including utilization fills).
- Explicitly import Feather outline icons, normally 20px/1.75px stroke. Color/background/border transitions last 150ms; reduced motion disables animation/transitions. No idle gauge animation/glow/backdrop.

## Layout and interaction

Reserve header/content/dock rows; only content scrolls. Content max-width: 1760px; desktop padding: 28px. Three center instruments lead Overview. System Info uses bars/specifications; task views use ruled layouts. Preserve drafts, full action scope/details and loading/stale/error/empty states.

Below 1200px services move below controls/instruments and Settings becomes one column. Below 768px use 16px horizontal padding, instruments before controls/services and hide workstation art. Dock exposes Overview, System Info, Conversations and More; More contains Music, Approvals, Memories, Settings and pending count. Preserve seven view IDs, lifecycle/profile access. Short desktop viewports shrink artwork/gauges.

Selected navigation uses readable accent, soft fill, rounded corners and inset bottom rule; retain `aria-current`. More exposes expanded state/Escape. Destructive confirmations contain focus, allow cancellation and restore focus. Fields retain visible labels/errors. Primary actions invert foreground/surface; secondary actions stay transparent; destructive actions use error color. Status labels remain text without capsule fills.

## Instruments and truthfulness

Gauges share 240-degree open-bottom arcs, four-unit round-ended strokes and slate track. Labels sit above, values inside, details below. Only finite 0–100 readings get percentages/fill; zero has no active stroke, 100 fills the sweep, unavailable values show a dash. Fill color follows utilization severity rather than accent. Bars use four-pixel tracks with the same severity coloring. Compact sparklines under instruments and the network/disk activity strip show the last ~15 minutes of App-buffered samples; fewer than two finite points stay empty. Local graphite workstation art is generic, not detected hardware.

Calendar and music empty states may offer one-click **externally** launches (Windows Calendar / provider app or HTTPS fallback) through approval-gated actions. Distinguish direct Wi-Fi/Bluetooth from Open Settings actions. Phone artwork follows available platform metadata; unknowns stay unknown. Provider availability never comes from decorative colors. Voice input/calendar editing are absent. Synthetic imagery/fixtures never become production telemetry. [Validation](docs/VALIDATION.md).
