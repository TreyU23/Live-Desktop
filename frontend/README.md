# Live Desktop frontend

The frontend is a React 19/Vite 6 true-black Windows dashboard. It includes local profile creation/switching/editing, a dedicated System Info tab for Windows-reported device and OS specifications, approval-backed direct Wi-Fi and Bluetooth toggles, explicit external-setting controls for unsupported Windows toggles, conversations, memories, approvals, iCloud Calendar, a persistent provider-switchable Apple Music/Spotify player, Phone Link status with platform-matched iPhone and Android artwork, settings, and frontend/backend lifecycle controls. The Home page's **System details** action opens the System Info tab. Profile names, uploaded avatars, theme, preset or custom hex accent color, selected music provider, and provider links stay in browser local storage and are namespaced per profile. For contrast, the Black accent renders as white in dark mode and black in light mode.

The System Info page consumes `GET /api/system`; it does not query Windows directly from the browser. See the root [system information access inventory](../docs/SYSTEM_INFORMATION.md) for the exact fields and sources.

Use the complete first-time setup, integration, security, build, and troubleshooting instructions in the [project README](../README.md).

For normal use, start the frontend and backend together from the repository root:

```powershell
.\start.cmd
```

For frontend-only development after the backend is already running:

```powershell
.\scripts\run-frontend.ps1
```

Open [http://localhost:4173](http://localhost:4173). Vite proxies `/health` and `/api` to `http://127.0.0.1:4317`.

For a fresh dependency install and production verification:

```powershell
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend run build
pnpm --dir frontend test
pnpm --dir frontend run test:sites
```

Settings can switch the existing dashboard and full Music widgets between Apple Music and Spotify. Each service uses its official web embed plus Windows' built-in media-session controls; neither path requires developer credentials. Separate links are retained per profile and provider so toggling services does not discard setup.
