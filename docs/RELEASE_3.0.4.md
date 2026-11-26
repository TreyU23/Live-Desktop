# Live Desktop 3.0.4

Reliability release. It closes the last eight open issues from the 3.0.0 release review: four ways the dashboard's system readings and the iCloud calendar could get stuck or blank, chats from two tabs mixing up a conversation, a wrong instruction at the end of the Java bootstrap script, build tools listed as production dependencies, and two tests that failed outside Windows or before a build. The interface is unchanged.

## Fixes

- **Chats from two tabs no longer interleave** ([#20](https://github.com/TreyU23/Live-Desktop/issues/20)). Only one reply per conversation is worked on at a time. Sending to a conversation that is still answering (from another tab or window) gets `409` with code `conversation_busy` and a "wait for that reply" message, and nothing is saved, so history stays in order.
- **Calendar requests can't hang forever** ([#17](https://github.com/TreyU23/Live-Desktop/issues/17)). When several requests ask for the same day while it refreshes, they share one refresh. If that refresh died with a JVM error, the others used to wait forever. Now the failed refresh frees its slot and releases them, and no request waits more than 20 seconds; a request that gives up gets an error status with the day's previous events.
- **Disk and network rates stay visible with two windows open** ([#16](https://github.com/TreyU23/Live-Desktop/issues/16)). Two pollers less than a second apart (two dashboard windows, or the dashboard and the assistant) used to reset each other's sample and both read "unavailable". They now share one baseline, and a caller that checks too soon gets the latest rates.
- **System readings no longer use the shared background thread pool** ([#15](https://github.com/TreyU23/Live-Desktop/issues/15)). Bridge calls for the dashboard snapshot run on their own four-thread pool, so a slow bridge can't stall other background work in the backend.
- **Device details recover if the bridge was slow at startup** ([#14](https://github.com/TreyU23/Live-Desktop/issues/14)). A failed first read of the device and Windows details used to leave fallback values on the dashboard until Live Desktop restarted. A failure is now retried after 30 seconds; a successful read is still kept for the whole session.
- **`bootstrap-java.ps1` points at the right launcher** ([#13](https://github.com/TreyU23/Live-Desktop/issues/13)). Its last line told package users to run `scripts/run-backend.ps1`, which the ZIP doesn't include. It now says to run `start.cmd`.
- **Build tools are dev dependencies** ([#24](https://github.com/TreyU23/Live-Desktop/issues/24)). `vite` and `@vitejs/plugin-react` move to `devDependencies` (same versions), so `pnpm audit --prod` covers only what the app uses at runtime. Nothing in the built app changes.
- **The test suites run on any platform** ([#23](https://github.com/TreyU23/Live-Desktop/issues/23)). The Windows URI test only runs on Windows, and the Sites packaging test skips with a reason when `dist/` hasn't been built, instead of failing.

## Compatibility

No data migration. Ports, the storage format and the rest of the local API are unchanged. One deliberate change: a second chat message to a conversation that is still answering gets `409 conversation_busy` instead of being processed alongside the first. The app sends one message at a time per tab, so this only shows up with two tabs or other clients.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v3.0.4), then check it against the signed tag:

```powershell
.\scripts\verify-release.ps1 -Zip .\Live-Desktop-windows-x64.zip -Tag v3.0.4
```

Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

Once the release is published, the same archive is available as `com.localassistant:live-desktop-windows-x64:3.0.4:zip`. See [package documentation](PACKAGES.md).

## Not included

The native binaries are still not Authenticode-signed, so SmartScreen may warn on first run; that needs a code-signing certificate. The assistant's workspace is still the installation folder (the lasting fix suggested in #2).

## Evidence limits

The full backend suite passed on Windows (115 tests, 0 failures, 1 skipped), including new tests for each fix, and the frontend unit tests passed (28/28). The cross-platform test changes were checked by running the Sites test without `dist/` (skips) and with it (passes); the backend suite wasn't run on Linux or macOS. The packaged app wasn't run by hand.

Changes since 3.0.3: https://github.com/TreyU23/Live-Desktop/compare/v3.0.3...v3.0.4
