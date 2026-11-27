# Live Desktop 3.1.3

A maintenance release with two correctness fixes and one release-pipeline security fix. The security fix affects how packages are published, not the running app.

## Fixes

- **Music controls act only on the selected provider** ([#33](https://github.com/TreyU23/Live-Desktop/issues/33)). With Apple Music or Spotify selected, play, pause, next and the now-playing widget used to follow any app that was playing, such as a YouTube video in Edge, even when the selected provider was paused. They now use that provider's own session (a playing one first, then a paused one). If the provider has no session, the widget shows "Nothing playing". Only the generic `music` provider still follows whatever is playing.
- **Moved and cancelled iCloud events are shown correctly** ([#34](https://github.com/TreyU23/Live-Desktop/issues/34)). When one occurrence of a recurring event was moved, the day view showed it twice: once at the old time and once at the new time. Cancelled events and cancelled occurrences were also shown as scheduled. An override now replaces the occurrence it moves, including one moved off the selected day, and cancelled items are skipped.
- **Package publishing requires the owner's signing key** ([#35](https://github.com/TreyU23/Live-Desktop/issues/35)). The publish workflow accepted a tag that GitHub marked "verified", which is true for a signature from any key registered to the tagger's account, and it skipped the check for versions below 3.0.3. It now checks the tag's SSH signature against the release key pinned in `.github/release-signers`, read from the default branch, and requires it for every version.

## Behavior change to know about

- **Spotify's web player in a browser is no longer controlled.** A browser reports its own app ID, not "spotify", and a browser session can't be told apart from other tabs such as a YouTube video. With Spotify selected, a web-player session now shows "Nothing playing" and the controls don't act on it. The Spotify desktop app and Apple Music are unaffected. The web player still plays in the embedded frame; only the Windows media controls and the widget metadata no longer follow it.

## Documentation

- `native/README.md` describes the per-provider session rule. `docs/PACKAGES.md` and `docs/PROJECT-WORKING-GUIDE.md` describe the pinned-key check.

## Compatibility

No data migration. Ports, the storage format and the local API are unchanged.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v3.1.3), then check it against the signed tag:

```powershell
.\scripts\verify-release.ps1 -Zip .\Live-Desktop-windows-x64.zip -Tag v3.1.3
```

Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

Once the release is published, the same archive is available as `com.localassistant:live-desktop-windows-x64:3.1.3:zip`. See [package documentation](PACKAGES.md).

## Not included

The native binaries are still not Authenticode-signed, so SmartScreen may warn on first run. The assistant's workspace is still the installation folder (#2). `.github/release-signers` is read from the default branch, so anyone who can push there can change the pinned key; branch protection is the safeguard and is not configured by this release.

## Evidence limits

Each change was checked when it was made, and the tests were not re-run for this release. On Windows: the bridge builds, the native ctest and the read-only bridge test pass, with no real Spotify, Apple Music or browser playback tried (#33). `ICloudCalendarServiceTest` (three new tests for a moved occurrence, a cancelled occurrence and a cancelled event) and `CalendarConcurrencyTest` pass, with no real iCloud account (#34). For #35, the `ssh-keygen` verification was run locally against the v3.1.2 tag and rejected a tampered payload; the workflow itself has not run on GitHub, so the first run is the real test. The release was reviewed by reading the changes, not by a formal security scan. The full backend suite wasn't run as one pass, and the packaged app wasn't run by hand.

Changes since 3.1.2: https://github.com/TreyU23/Live-Desktop/compare/v3.1.2...v3.1.3
