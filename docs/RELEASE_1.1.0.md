# Live Desktop 1.1.0

Final 1.x release. It refines the Flight Deck Overview and hardens the local API so other websites and LAN clients cannot drive the dashboard backend.

## What's changed

### Security
- **Per-launch API token.** Each backend launch generates a random 256-bit token, returned as `X-Live-Desktop-Token` only on loopback `GET /health`. Every other route requires it (constant-time comparison). The dashboard reads and sends it automatically.
- **Stricter request checks.** `Host` must be `127.0.0.1`/`localhost` on the accepting port; a sent `Origin` must be the dashboard or the backend itself; duplicate `Origin`/token headers are rejected; `POST`/`DELETE` require `Content-Type: application/json`. This blocks cross-site and DNS-rebinding calls to the local API.
- **`/health` no longer reveals the workspace path.**
- **Development server is loopback by default.** Vite now binds `127.0.0.1:4173` unless `VITE_HOST` is set (previously `0.0.0.0`). When it is exposed, the dev proxy withholds the token from non-loopback callers. The backend cannot see the real caller behind the proxy, so this check lives in the proxy (fixed during the 1.1.0 release review).

### Overview
- Resource gauges show warning/critical thresholds (`utilizationSeverity`).
- Network and disk activity sparklines are fed by real Windows I/O counters (new `system.ioCounters` bridge call). Rates stay unavailable rather than zero until two valid samples exist.
- Calendar and music empty states offer labeled "open externally" actions (Windows Calendar or iCloud Calendar on the web; Spotify or Apple Music). They use fixed destinations, and each one needs first-use approval like other device actions.

### Documentation and repository
- Consolidated README, backend/frontend/native READMEs and `docs/VALIDATION.md`; added the [Project working guide](PROJECT-WORKING-GUIDE.md).
- Removed obsolete performance data, screenshots and planning artifacts (about 21k lines).

## Compatibility

No data migration. Ports, approval policy, profiles and storage format are unchanged. **Breaking for custom scripts only:** direct callers of `127.0.0.1:4317` must first read `X-Live-Desktop-Token` from `GET /health` and send it on later requests (see the README troubleshooting table). The bundled dashboard already does this.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v1.1.0). Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

The same archive is published as `com.localassistant:live-desktop-windows-x64:1.1.0:zip`. See [package documentation](PACKAGES.md).

## Release validation

Results of the release build, the automated tests and the packaged-runtime checks, plus the SHA-256 of the published ZIP, are on the [GitHub release page](https://github.com/TreyU23/Live-Desktop/releases/tag/v1.1.0).

## Evidence limits

Automated checks use synthetic integrations. Authenticated OpenAI/iCloud/music responses, physical radio changes, Phone Link notification availability, screen readers, sleep/resume and independent Windows-user sessions require separate acceptance checks.

Changes since 1.0.0: https://github.com/TreyU23/Live-Desktop/compare/v1.0.0...v1.1.0
