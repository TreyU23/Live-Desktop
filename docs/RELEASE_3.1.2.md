# Live Desktop 3.1.2

A maintenance release. It adds a way to delete a conversation for good, fixes two reliability problems (a profile deletion reported as a timeout, and a full browser storage crashing the app), makes the approval documentation match what the code does, and adds a one-command source build. There are no security fixes in this release and no changes to the assistant model choices from 3.1.0.

## New

- **Delete a conversation.** Open a thread in Conversations and choose **Delete**. After a confirmation, the conversation and all its messages are removed from this PC: the saved state file is rewritten without it, and the open thread, the thread list and the app's cached copy are cleared. The delete is refused while that conversation is still waiting on a reply (the thread stays open and says why), so a late reply can't bring it back. It adds one local API route, `DELETE /api/conversations/{id}` (`204`, `404` for an unknown id, `409` while a reply is in progress). See the limits below.
- **One-command source build.** `build.cmd` installs the project-local Java and the frontend dependencies if they are missing, then builds everything. `build.cmd run` stops a running instance, rebuilds and starts it. The individual steps still work on their own.

## Fixes

- **A deleted profile is reported as deleted with OpenAI too.** If a profile was deleted while a chat on it was waiting on OpenAI and the call then failed past the time limit, the failure was reported as a timeout. It now ends the request with the deletion (`409`), as the Claude path already did in 3.1.1. The check is shared by both providers.
- **A full browser storage no longer crashes the app.** When the browser refused to store a theme, accent, music or profile setting, the error went uncaught inside a React effect and unmounted the whole app. The setting now still applies for the session and an error message says it couldn't be saved. Switching profiles no longer reloads onto the old profile when the choice can't be stored.

## Documentation

- The approvals documentation and the assistant's write and memory tool descriptions now say what the code does: an approval matches the exact content for a file, or the exact text in a memory category, so anything else asks again. The project map's memory row was out of date for the same reason.

## What deleting a conversation does not do

- **Memories and approvals are kept.** They have no link to the conversation they came from, so an approved memory or an earlier approval can still hint that a conversation happened. Remove those in Memories and Approvals.
- **It is deletion, not secure erasure.** The old state file's disk blocks are not overwritten. Model requests use no server-side storage (OpenAI calls set `store=false`), and the optional diagnostics log records routes, never conversation ids or content.

## Compatibility

No data migration. Ports, the storage format and every existing local API route are unchanged; the only addition is the delete route above.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v3.1.2), then check it against the signed tag:

```powershell
.\scripts\verify-release.ps1 -Zip .\Live-Desktop-windows-x64.zip -Tag v3.1.2
```

Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

Once the release is published, the same archive is available as `com.localassistant:live-desktop-windows-x64:3.1.2:zip`. See [package documentation](PACKAGES.md).

## Not included

The native binaries are still not Authenticode-signed, so SmartScreen may warn on first run. The assistant's workspace is still the installation folder (the lasting fix suggested in #2).

## Evidence limits

Each change was checked when it was made, and the tests were not re-run for this release. On Windows: `OpenAiAgentTest` (new; fails without its fix) for the OpenAI deletion fix; frontend unit tests 35/35 and a browser check with a refusing `localStorage` (theme switched, error shown, app stayed mounted) for the storage fix; `StateStoreTest` (new test that a deleted conversation's text is gone from the state file and cache), `ConcurrentChatTest`, `AssistantApplicationTest` and `LocalAccessFilterTest` for the delete route; frontend unit tests 36/36; and a browser check of the Delete button in light and dark mode against the built frontend with a mocked API (cancel, a refused delete, a successful delete). The delete route has no HTTP-level test for its `404` and `409` responses. The release was reviewed by reading the code changes since 3.1.1, not by a formal security scan; that review found nothing that blocks release. The full backend suite wasn't run as one pass, no live call was made to either model provider, and the packaged app wasn't run by hand.

Changes since 3.1.1: https://github.com/TreyU23/Live-Desktop/compare/v3.1.1...v3.1.2
