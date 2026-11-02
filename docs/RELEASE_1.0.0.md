# Live Desktop 1.0.0

The Flight Deck redesign covers Overview, System Info, Conversations, Music, Approvals, Memories and Settings. Overview puts PC instruments first, alongside system controls, calendar, Phone Link and the compact music player. Reserved navigation adapts to narrow windows. Settings retains profile-scoped appearance and account connections.

Missing readings remain unavailable, actual zero values are preserved, failed refreshes retain last-known values with retry, and failed submissions retain drafts. Approval details show targets, literal content, outcomes and reusable scope. Shutdown uses a focus-contained confirmation. Calendar day and Phone Link detail panels expand inside the dashboard; external actions are labeled.

The redesign retains the existing API, ports, approval policy, scheduler, native runtime and storage format. It introduces no data migration. Voice input, calendar editing and unsupported playback features are not provided.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v1.0.0). Extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included and development tools are unnecessary.

Before upgrading, shut down the owned instance and back up `data/` and your private configuration. Preserve those files when replacing runtime files. DPAPI credentials remain tied to the same Windows user. To roll back, stop the application and restore the previous compatible runtime while preserving your data.

The same archive is distributed as `com.localassistant:live-desktop-windows-x64:1.0.0:zip`. See [package documentation](PACKAGES.md) for authenticated GitHub Maven downloads.

## Evidence limits

Build, automated browser and packaged-runtime checks exercise application behavior and synthetic integrations. Authenticated OpenAI/iCloud/music responses, physical radio changes, Phone Link notification availability, screen readers, actual browser UI zoom, sleep/resume and independent Windows-user sessions require separate acceptance checks. See [redesign validation](redesign/implementation-validation/README.md) for historical implementation evidence.
