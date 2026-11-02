---
name: Live Desktop — Flight Deck
description: A precise local Windows dashboard with PC telemetry at its center.
colors:
  page: "#000000"
  surface: "#090c10"
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
    fontFamily: "Bahnschrift, 'Segoe UI', sans-serif"
    fontSize: "clamp(24px, 2.2vw, 30px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: ".025em"
  title:
    fontFamily: "Bahnschrift, 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  prose:
    fontFamily: "'Segoe UI', sans-serif"
    fontSize: "16px"
    lineHeight: 1.75
  label:
    fontFamily: "Bahnschrift, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: ".06em"
  measurement:
    fontFamily: "Consolas, monospace"
  instrument:
    fontFamily: "Bahnschrift, 'Segoe UI', sans-serif"
    fontSize: "clamp(24px, 3vw, 42px)"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  square: "0"
  control: "3px"
  dialog: "4px"
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
    rounded: "{rounded.square}"
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

# Design System: Live Desktop — Flight Deck

## Overview

**Creative North Star: "Flight Deck"**

Flight Deck is a quiet instrument panel for the state of a Windows PC. True black, clear blue telemetry, restrained headings, and compact operational detail make the system feel precise and immediately readable. The computer remains the primary subject; controls and connected services support it.

The same typography and rectangular structure carry into text-first conversations, approvals, memories, and settings. Depth is restrained, status is explicit, and motion serves interaction. The system accommodates light mode and saved custom accents without changing the visual grammar.

**Key Characteristics:**
- PC state before assistant content.
- Blue instruments and readable tabular measurements.
- Rectangular surfaces with hairline structure.
- Text-first task workspaces with clear actions and availability.
- Reserved header, scrolling content, and bottom navigation.

## Colors

The default palette combines true black and cool neutral structure with an electric blue accent; semantic status colors remain independent of the selected accent. Frontmatter records the default CSS palette and separate light palette. CSS custom properties remain the runtime authority.

### Primary
- **Flight Blue** (`accent`): quantitative fills and selected interactions. Text, links, focus, and active-control strokes use the readable accent variant.
- **Blue Recess** (`accent-soft`): the stylesheet's default soft accent token. At runtime the application computes this token from the saved accent at 16% opacity; do not hard-code the startup value into new components.
- **Readable Accent Fallbacks**: pale blue for dark mode and deep blue for light mode when the selected accent does not meet the implemented text-contrast threshold.

### Neutral
- **True Black** (`page`): the default page and field canvas.
- **Instrument Black** (`surface`) and **Hover Slate** (`surface-hover`): modest tonal separation for dock, overlays, and interactive state.
- **Structural Slate** (`line`) and **Control Slate** (`line-strong`): separators and stronger interactive boundaries.
- **Signal White** (`text`) and **Telemetry Gray** (`muted`): primary and supporting text. Primary buttons invert the foreground and surface roles.
- **Light Canvas** and its `light-*` companions: a distinct cool light surface system with dark text and adjusted boundaries, rather than an inverted screenshot.

### Semantic status
- **Ready Mint** (`ready`): connected and completed states.
- **Attention Amber** (`attention`): pending work, stale resources, and capability notices.
- **Failure Rose** (`error`): failures and destructive actions.
- Their `light-*` equivalents preserve the same meaning on light surfaces.

**The Readable Accent Rule.** Preserve the user's saved accent; derive a readable variant for text and focus. Black accents become white in dark mode. Semantic statuses never inherit the arbitrary accent.

## Typography

**Display / Heading Font:** Bahnschrift with Segoe UI and sans-serif fallbacks.
**Body Font:** Segoe UI with sans-serif fallback.
**Measurement Font:** Consolas with monospace fallback, with tabular figures for numbers, IDs, code, and times.

Bahnschrift gives headings an instrument-panel character while Segoe UI keeps operational prose familiar. Use weight and spacing to separate hierarchy; avoid turning body copy into widely tracked uppercase labels.

### Hierarchy
- **Headline:** page titles use the responsive headline role.
- **Title:** section headings use the title role; compact tertiary headings use 14px.
- **Body:** standard controls and explanatory text use the body role.
- **Prose:** conversation messages use the prose role and a maximum line width of 72ch. Memory records also use 16px text.
- **Label:** rail headings use the label role and uppercase. Supporting metadata is generally 11–12px.
- **Instrument:** gauge numerals use the instrument role with tabular figures; narrow screens use 27px numerals. Monospace is reserved for measurement-oriented content.

## Layout

The shell fills the dynamic viewport and reserves three grid rows: header, independently scrolling content, and bottom dock. Content is centered within a maximum width of 1760px, with 28px desktop padding. Avoid overlays that hide the composer or the last row of content.

The desktop overview places controls at left, PC instruments in the broad center, and services at right. Three gauges form the central instrument row. System Info uses horizontal resource bars and specification rows. Task views use list/detail or rail/content arrangements, separated by rules rather than a grid of decorative cards.

At widths up to 1199px, services move below the controls and instruments; settings collapse to one column. At widths up to 767px, content uses 16px horizontal padding and a single column, the PC schematic is hidden, and the instruments retain readable values. The dock shows Overview, System Info, Conversations, and More; More discloses Music, Approvals, Memories, and Settings with the pending approval count. The header wraps while preserving lifecycle and profile access.

Spacing follows the frontmatter scale. Larger layout separations also use observed 28px and 48px gaps; this is not a rule that every dimension must be a scale token. At desktop widths with viewport height up to 800px, the schematic and gauges shrink to preserve useful content.

**The Reserved Shell Rule.** Put navigation in its own shell row and let only the content region scroll.

## Elevation & Depth

Main surfaces are flat and structured by rules, spacing, and subtle tonal contrast. Shadows are limited to transient overlays: the More disclosure, profile menu, confirmation dialog, lifecycle notice, and toast. No ambient glow, animated backdrop, or idle gauge animation is part of the system. The sidecar records the exact overlay shadows.

Interaction transitions last 150ms and change background, border, or text color. Respect reduced-motion preferences by disabling transitions and animation.

## Shapes

The form language is rectangular: square navigation and rows, lightly eased control corners, and a slightly eased confirmation dialog. Thin rules organize content. Circles belong to resource gauges, identity avatars, status dots, accent swatches, and the settings switch; they are functional exceptions rather than a general card language.

## Components

### Buttons

Filled primary actions use the foreground/surface inversion, an outlined boundary, and semibold text. Secondary actions are transparent with a strong outline. Text actions use the readable accent; destructive actions use the error color. Standard buttons have a 44px minimum target height and the control radius. Hover raises boundary contrast; keyboard focus uses a visible 2px readable-accent outline with a 4px offset. Disabled buttons lower opacity and use the unavailable cursor.

### Status labels

State labels are compact text, despite the legacy “pill” naming in code; do not add capsule backgrounds. Completed and connected use Ready Mint, pending and approved use Attention Amber, and failed uses Failure Rose. Keep a readable state word so meaning does not depend on color alone.

### Cards / Containers

Settings sections, specifications, memory records, and approval rows rely on ruled boundaries and generous grouping. They do not require a filled rounded card around every item. The settings container has a top rule and 32px vertical padding. Transient overlays use the instrument surface and a stronger border.

### Inputs / Fields

Fields use the page surface, primary text, a strong one-pixel outline, the control radius, and 44px minimum height. Placeholder text uses the muted role, with full opacity. Carets and keyboard focus use the readable accent. Retain visible field labels and actionable error text.

### Navigation

Desktop navigation uses seven labeled destinations with small Feather outline icons. The selected destination has primary text, a hover-slate surface, and an inset accent rule along its bottom edge. The narrow More control is an explicit disclosure with expanded state, Escape handling, and a reachable list of the remaining destinations. Preserve `aria-current` on the selected destination.

### Resource instruments

Circular gauges use a restrained five-unit SVG stroke, structural track, accent fill, and a centered label/value/detail stack. Horizontal bars use a four-pixel track and a nearby numerical value. Only finite readings in the range 0–100 receive a fill and percentage; missing or invalid readings show a dash and explanatory detail. Instruments update when readings change, with no animation loop. Example readings in the sidecar are illustrative component previews, never production fixtures.

## Do's and Don'ts

### Do:
- **Do** keep PC instruments readable before adding supporting service detail.
- **Do** consume semantic CSS properties so light mode and saved accents remain consistent.
- **Do** preserve clear selected, focus, pending, stale, failure, and unavailable states.
- **Do** use rules and spacing to organize text-first task views.
- **Do** reserve viewport space for the header and bottom dock.

### Don't:
- **Don't** replace the default true-black canvas with a gradient or ornamental backdrop.
- **Don't** turn every section into a rounded floating card.
- **Don't** use color alone to convey status or imply a healthy value from missing data.
- **Don't** animate gauges continuously or add decorative motion loops.
- **Don't** overwrite saved accents or use custom accents for warning and error meaning.
