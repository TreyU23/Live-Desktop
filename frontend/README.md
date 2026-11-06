# Frontend

React 19/Vite 6 renders seven Flight Deck views. `App.jsx` owns APIs, profiles and mutations; `src/views/` and `src/components/` own presentation. Styles split into tokens, shell, components and views. [Root setup/accounts](../README.md), [design contract](../DESIGN.md).

## Development and build

From the repository root, with Node 20.19+ or 22.12+ and pnpm:

```powershell
pnpm --dir frontend install --frozen-lockfile
.\scripts\run-frontend.ps1
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:sites
```

The script can use Codex's bundled Node/pnpm and starts loopback Vite on strict port 4173, proxying `/api` and `/health` to 4317. The dev proxy rewrites `Host` to the backend so the backend allowlist matches the accepting port. `vite.config.mjs` binds to `127.0.0.1` unless `VITE_HOST` is set. `App.jsx` reads `X-Live-Desktop-Token` from a loopback `GET /health` and sends it on later calls. `POST` and `DELETE` send `Content-Type: application/json`. `VITE_API_BASE` overrides the API at build/development time; a loopback override on port 4173 or the backend port can read the token header.

Production serves `dist/client/` through the native host without Node. The build also emits `dist/server/index.js` and `dist/.openai/hosting.json`; preserve `.openai/hosting.json`, `worker/index.js`, the preparation script and Sites tests. A hosted preview needs its own backend integration for local Windows features.

## State and refresh contracts

`resourceScheduler.js` commits resources independently, permits one read per resource and applies a 12-second deadline. Reads capture profile identity; teardown aborts them. Mutations invalidate reads before and after writes so older responses cannot overwrite confirmed results. Manual refresh joins existing reads. Healthy scheduling stays in refs; visible state tracks loading, errors/recovery and freshness. Failures retain last-known data with retry; successful empty lists remain empty; missing readings show a dash.

| Resource | Interval after completion |
| --- | --- |
| Media | 5 seconds |
| Phone Link | 10 seconds |
| System | 15 seconds |
| Health/runtime | 30 seconds |
| Apps/actions/memories/conversations/settings | 60 seconds |
| Calendar | 4 minutes |

Hidden documents pause routine reads; visibility restoration triggers deduplicated refreshes. Profile switching stops old reads and reloads; request headers/browser preferences retain profile identity. Failed assistant/memory submissions preserve drafts. Successful saves clear drafts even if list refresh fails.

The selected music embed mounts on first Music visit and persists across navigation; provider switches replace it. Metadata comes from Windows sessions. Phone artwork reflects available platform metadata. Calendar/phone details expand within Overview. Unsupported controls say Open Settings; direct radio state uses confirmed results. Voice input/calendar editing are not implemented.

Header, scrolling content and dock use separate rows. Below 768 px, More contains Music, Approvals, Memories and Settings. Saved theme/accent preferences are profile scoped; readable accents preserve contrast. Shutdown/profile deletion confirmations contain keyboard focus, support Escape and restore focus. Generic workstation art does not identify detected hardware.

[Validation commands/limits](../docs/VALIDATION.md) cover browser rendering, polling, mutation races, production smoke and diagnostics. Synthetic browser evidence goes under ignored `backend/target/`.
