# Live Desktop 3.1.1

Security and reliability release. It closes the five issues from the 3.1.0 review: two ways an approved assistant write could plant something that runs later, a profile deletion that a retried Claude request could undo, Claude replies that were cut off without saying so, and a profile photo that could fill browser storage and silently stop profile changes from saving. The assistant model choices from 3.1.0 are unchanged.

## Security fixes

- **Assistant writes can't change build, editor or agent files** ([#25](https://github.com/TreyU23/Live-Desktop/issues/25)). Live Desktop's own folders were already off-limits, but files at the workspace root and in other folders were not, which in a source checkout included `pom.xml`, `mvnw`, `.vscode/tasks.json` and `AGENTS.md`: files that run code on the next build or editor open, or steer coding agents. Writes now refuse every file at the workspace root, every dot-file and dot-folder (`.vscode`, `.idea`, `.env`, ...), and build, editor and agent files by name anywhere (`pom.xml`, `mvnw`, `package.json`, Gradle files, `Makefile`, `AGENTS.md`, `CLAUDE.md`, ...). Write into a folder such as `notes/`.
- **Assistant writes are limited to plain-text types** ([#26](https://github.com/TreyU23/Live-Desktop/issues/26)). The list of blocked executable types missed several that Windows runs or acts on when a file is opened or its folder is browsed (`.js`, `.url`, `.scf`, `.pif`, `.msc`, `.chm`, `.inf`, ...). It is replaced by an allowlist: `.txt`, `.md`, `.markdown`, `.json`, `.csv`, `.tsv`, `.yaml`, `.yml`, `.toml`, `.ics` and `.log`. Anything else, including files with no extension, is refused. The write tool's description and the approval sheet say what can be written.

## Fixes

- **A deleted profile stays deleted when a Claude request is retried** ([#27](https://github.com/TreyU23/Live-Desktop/issues/27)). If a profile was deleted while a chat on it was waiting on Claude and the connection then failed, the retry could succeed and save the reply, recreating the deleted profile's folder. The deletion now ends the request (`409`) instead of being retried away, and once a request has seen its profile deleted, it keeps seeing it.
- **Cut-off Claude replies say so** ([#28](https://github.com/TreyU23/Live-Desktop/issues/28)). A reply that reached the 32k output limit (thinking counts toward it) used to come back as if complete, or as "I could not produce a text response." It now ends with a note that it was cut off, or says the reply hit the limit if there was no text yet. A tool call cut off mid-way is never run.
- **Profile photos no longer break profile saving** ([#29](https://github.com/TreyU23/Live-Desktop/issues/29)). A full-size phone photo was stored as-is and could overflow the browser's ~5 MB storage for the app; after that, renames, new profiles and switches were lost on reload with no message. Photos are now cropped to a 256 px square and stored as a small WebP (about 30 KB; JPEG where WebP isn't available). Images over 20 MB or that can't be read are refused with a message, and if a profile change can't be saved, an error appears instead of the change seeming to work.

## Compatibility

No data migration. Ports, the storage format and the local API are unchanged. Two deliberate changes:

- An assistant write to the workspace root, a dot-folder, a build/editor/agent file or a non-text type that used to be allowed is now refused, even if an earlier identical write was approved. Ask the assistant to write into a folder with a text type.
- A photo you already set keeps working as stored; only newly chosen photos are resized.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v3.1.1), then check it against the signed tag:

```powershell
.\scripts\verify-release.ps1 -Zip .\Live-Desktop-windows-x64.zip -Tag v3.1.1
```

Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

Once the release is published, the same archive is available as `com.localassistant:live-desktop-windows-x64:3.1.1:zip`. See [package documentation](PACKAGES.md).

## Not included

The native binaries are still not Authenticode-signed, so SmartScreen may warn on first run. The assistant's workspace is still the installation folder (the lasting fix suggested in #2); the write rules above narrow what it can change there.

## Evidence limits

New tests cover each fix, and each was run on Windows: `WorkspaceServiceTest` and `ActionServiceTest` (#25, #26); `AnthropicAgentTest` and `ProfileLifecycleTest` (#27, #28), with the two #27 tests confirmed to fail without the fix; `ConcurrentChatTest`, `ProfileIsolationTest` and `ChatTimeoutBudgetTest` alongside; frontend unit tests 33/33. The photo fix was checked in Edge against the built frontend in light and dark mode: a 9 MB PNG was stored as a 27 KB WebP, a rename afterwards saved, and an unreadable image showed an error. The full backend suite wasn't re-run as one pass, no live call was made to either model provider, and the packaged app wasn't run by hand.

Changes since 3.1.0: https://github.com/TreyU23/Live-Desktop/compare/v3.1.0...v3.1.1
