# Live Desktop 2.0.0

The dashboard is rebuilt on the [Astryx](https://github.com/meta/astryx) design system. All seven views, profiles, approvals and integrations work as before. What changes is how they look and how a few of them are laid out. The release also adds a Content Security Policy and sandboxes the music player.

## What's changed

### New interface
- **Astryx components on a local theme** derived from Astryx's neutral theme, using Segoe UI Variable with no web fonts. The glass look (wallpaper, translucent cards, gauge glow) is gone; surfaces are solid.
- **Appearance:** Light, Dark or **System** (follows Windows), saved per profile. Accent is Neutral (black and white, the new default) or one of four presets: Blue, Green, Orange, Red. An accent saved by 1.x is moved to the nearest preset.
- **Navigation:** a side menu on desktop that folds into a drawer below 768 px. Restart and Stop Live Desktop sit beside each page title.
- **Overview:** three instrument tiles (CPU, memory, storage) with severity labels, a banner when requests wait for approval, This PC beside Controls (Wi-Fi/Bluetooth switches, Windows Settings shortcuts), Ask Live Desktop, Calendar, Now playing, Phone, Connections and Recent activity.
- **Approvals:** Pending/History tabs and a table with **Don't Allow** / **Allow** on each row. Each row expands to show the target, the reusable approval scope and the full content before you decide.
- **Conversations:** thread panel beside the chat (a drop-down on phones). The approval window shows "Allow Live Desktop to …?" with the content, scope, **Decide later**, **Don't Allow** and **Allow**.
- **Memories:** searchable table, delete asks first, and **Add memory** opens a small form.
- **System Info:** Live and Specifications tabs. Live shows resource bars, network and disk speeds with 15-minute trends, and device and Windows details. IDs stay hidden until **Show IDs**.
- **Music:** choose Apple Music or Spotify on the page itself; the provider's player still keeps playing while you switch views.

### Removed
- **Reduce transparency.** There is nothing transparent left to reduce; the saved setting is cleared automatically.
- Custom hex accent colors (replaced by the presets above).
- The generic workstation illustration on System Info.

### Security
- **Content Security Policy** on the dashboard: scripts and stylesheets only from Live Desktop itself, and frames only from Apple Music and Spotify.
- **Sandboxed music player.** The provider's embedded player runs with only the permissions it needs to sign in and play.
- New automated checks: the iCloud app-specific password is never shown back in the page or stored in the browser, and Device/Product IDs stay hidden until requested.

### Accessibility
- Theme colors are checked automatically for contrast in light and dark mode for every accent.
- axe-core reports no violations on all seven views in both modes at desktop and phone widths.

## Compatibility

No data migration. Ports, the local API and its token, approval policy, profiles and storage format are unchanged. Profile appearance settings carry over (Light/Dark kept; a custom accent maps to the nearest preset; Reduce transparency is dropped).

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v2.0.0). Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

The same archive is published as `com.localassistant:live-desktop-windows-x64:2.0.0:zip`. See [package documentation](PACKAGES.md).

## Evidence limits

Automated checks use synthetic integrations. Authenticated OpenAI/iCloud/music responses, physical radio changes, Phone Link notification availability, screen readers, touch target size on touch devices, sleep/resume and independent Windows-user sessions require separate acceptance checks. The new design has not yet been checked in Microsoft Edge.

Changes since 1.1.0: https://github.com/TreyU23/Live-Desktop/compare/v1.1.0...v2.0.0
