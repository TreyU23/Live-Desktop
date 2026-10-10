# Live Desktop frontend

The frontend is a React 19/Vite 6 true-black Windows dashboard. It includes local profile creation/switching/editing, a dedicated System Info tab for Windows-reported device and OS specifications, one-time-approval-backed direct Wi-Fi and Bluetooth toggles, explicit external-setting controls for unsupported Windows toggles, conversations, memories, approvals, iCloud Calendar, a persistent provider-switchable Apple Music/Spotify player, Phone Link status with platform-matched iPhone and Android artwork, settings, and frontend/backend lifecycle controls. The first press of an unapproved capability adds it to Approvals; after approval, later matching presses run immediately for that profile. The Home page's **System details** action opens the System Info tab. Profile names, uploaded avatars, theme, preset or custom hex accent color, selected music provider, and provider links stay in browser local storage and are namespaced per profile. For contrast, the Black accent renders as white in dark mode and black in light mode.

The System Info page consumes `GET /api/system`; it does not query Windows directly from the browser. Completed Wi-Fi and Bluetooth actions apply their returned state immediately instead of waiting for a full dashboard reload. See the root [system information access inventory](../docs/SYSTEM_INFORMATION.md) for the exact fields and sources.

Use the complete first-time setup, integration, security, build, and troubleshooting instructions in the [project README](../README.md).

For normal use, start the frontend and backend together from the repository root:

```powershell
.\start.cmd
```

For frontend-only development after the backend is already running:

```powershell
.\scripts\run-frontend.ps1
```

Open [http://localhost:4173](http://localhost:4173). Production serves `dist/client` through `native/build/Release/live-desktop-host.exe`, launched directly by the C++ supervisor. Node is required only for frontend builds/development. It binds to `127.0.0.1:4173`, proxies `/health` and `/api` to `http://127.0.0.1:4317`, and rejects unexpected Host and Origin headers. The host serves SPA routes, returns 404 for missing assets, streams API responses, and confines file access to the canonical client directory. It supports GET/HEAD for static assets and forwards API methods, query strings, profile/auth headers, and bodies. Request headers are limited to 32 KiB, bodies to 16 MiB, and the upstream timeout is 120 seconds. It uses 16 workers with a bounded queue; it closes each HTTP connection after responding. `/_live/ready` identifies the native host; `/health` still proxies the backend. It requires no Node, pnpm, or Vite process at startup. Build all production artifacts with `scripts/build-production.ps1` from the repository root before first launch and after source changes. Frontend-only development still uses Vite and its development proxy.

For a fresh dependency install and production verification:

```powershell
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend run build
pnpm --dir frontend test
pnpm --dir frontend run test:sites
```

Settings can switch the existing dashboard and full Music widgets between Apple Music and Spotify. Each service uses its official web embed plus Windows' built-in media-session controls; neither path requires developer credentials. Separate links are retained per profile and provider so toggling services does not discard setup.

Run `scripts/test-native-host.ps1` from the root with both application ports free after building the native host. The build-time Node test driver covers native serving and proxy security/compatibility. Distribution is handled by `scripts/package-production.ps1`; see the root README for runtime ZIP installation.
