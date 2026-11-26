# Live Desktop 3.0.3

Security release. It fixes the five remaining low-severity problems from the 3.0.0 release review: an outdated Vite dev server, saved music links that weren't re-checked, raw error messages reaching the UI and the model, unchecked profile and conversation IDs, and a release checksum that couldn't detect tampering. The interface is unchanged.

## Fixes

- **Dev server updated and locked to local hosts** ([#22](https://github.com/TreyU23/Live-Desktop/issues/22)). Vite goes from 6.4.2 to 6.4.6, and postcss's `nanoid` and `source-map-js` are refreshed; `pnpm audit --prod` now reports no advisories (it listed 9, 3 high). The extra `terminal.local` dev host is gone. This affects development only; nothing here ships in the built app.
- **Saved music links are checked again when they load** ([#21](https://github.com/TreyU23/Live-Desktop/issues/21)). A link read back from browser storage goes through the same Apple Music / Spotify allowlist as when it was first saved. One that fails falls back to the default instead of becoming the music player's frame.
- **Errors no longer leak paths or upstream details** ([#19](https://github.com/TreyU23/Live-Desktop/issues/19)). Error responses now carry `{error, code}`. Live Desktop's own validation and status messages still come through as before; anything else (file-system errors with install paths, OpenAI errors, parser errors) becomes a stable code with a generic message and a short reference, and the full detail goes to the backend log. Tool results the assistant sees and failed approvals follow the same rules.
- **Profile and conversation IDs are validated** ([#18](https://github.com/TreyU23/Live-Desktop/issues/18)). `X-Profile-Id` must be `default` or the UUID form the app creates; anything else gets `400` instead of quietly using the default profile. A profile now exists only once something is saved for it: looking at a profile that doesn't exist writes nothing to disk and caches nothing, and at most 64 profile folders can be created. Conversation IDs are always made by the server.
- **The release hash is covered by the signed tag** ([#12](https://github.com/TreyU23/Live-Desktop/issues/12)). The ZIP's SHA-256 is now in the message of the signed `v3.0.3` tag, not just in a file next to the ZIP. `scripts\verify-release.ps1` checks a download against it, and the package workflow refuses to publish when the tag isn't verified or the hash differs. The workflow's `actions/setup-java` step is pinned to a commit.

## Compatibility

No data migration. Ports, the local API and the storage format are unchanged. Three behaviors change on purpose: a malformed `X-Profile-Id` gets `400` instead of the default profile; a chat request naming a conversation that doesn't exist starts a new one under a server-made ID (returned as `conversationId`); and a profile you only looked at, never saved to, no longer leaves an empty folder in `data/profiles/`.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v3.0.3), then check it against the signed tag:

```powershell
.\scripts\verify-release.ps1 -Zip .\Live-Desktop-windows-x64.zip -Tag v3.0.3
```

Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

Once the release is published, the same archive is available as `com.localassistant:live-desktop-windows-x64:3.0.3:zip`. See [package documentation](PACKAGES.md).

## Not included

The native binaries are still not Authenticode-signed, so SmartScreen may warn on first run; that needs a code-signing certificate. The assistant's workspace is still the installation folder (the lasting fix suggested in #2).

## Evidence limits

The backend test suite passed (95 tests, 1 skipped) with the new tests for error mapping, profile IDs and conversation IDs, and the music-provider tests passed. The workflow's signed-tag check runs only when a release is published, so it hasn't run on GitHub yet; the same check in `verify-release.ps1` was run against the existing `v3.0.2` tag.

Changes since 3.0.2: https://github.com/TreyU23/Live-Desktop/compare/v3.0.2...v3.0.3
