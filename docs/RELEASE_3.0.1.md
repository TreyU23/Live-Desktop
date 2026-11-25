# Live Desktop 3.0.1

Bug-fix release. It fixes three problems found in the 3.0.0 release review: the dashboard freezing during a chat, the Windows bridge restarting under load, and long chats failing in the browser while the reply was still being saved. The interface is unchanged.

## Fixes

- **Deleting something during a chat no longer freezes the dashboard** ([#6](https://github.com/TreyU23/Live-Desktop/issues/6)). Deleting a memory, an OpenAI key or the iCloud connection while the assistant was replying used to stall every view of that profile until the reply finished. These deletes now go through right away. Only deleting a whole profile waits for other work on it, and a chat running at that moment stops without saving and reports that the profile was deleted.
- **The Windows bridge no longer restarts when it is busy** ([#10](https://github.com/TreyU23/Live-Desktop/issues/10)). One slow Windows query (battery, WMI or the media session) could make the requests queued behind it time out, and each of those restarted the bridge, so the dashboard flickered between "unavailable" and normal. Waiting in the queue and running the request now have separate 15-second limits. A request that waits too long reports that the bridge is busy, and only a request that actually hangs restarts it.
- **Long chats finish instead of showing an error** ([#11](https://github.com/TreyU23/Live-Desktop/issues/11)). The page host gave up on any request after 120 seconds, so a question needing several tool calls showed an error while the reply was still saved later, and retrying created a second copy. The assistant now has a 240-second limit for the whole request and the host waits up to 300 seconds for a chat. If the assistant runs out of time, you see a clear message and nothing is saved.

## Compatibility

No data migration. Ports, the local API and its token, approval policy, profiles and storage format are unchanged. Two new API responses: `/api/chat` returns `409` when the profile is deleted mid-chat and `504` when the assistant runs out of time. Bridge calls can now return the code `BRIDGE_BUSY`.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v3.0.1). Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

The same archive is published as `com.localassistant:live-desktop-windows-x64:3.0.1:zip`. See [package documentation](PACKAGES.md).

## Known issue

If a chat fails (profile deleted, out of time, or an OpenAI error), your message has already been saved to the conversation, so sending it again adds it a second time.

## Evidence limits

The fixes are covered by new automated tests with simulated delays and a simulated bridge. The 240-second limit has not been exercised against a real long OpenAI conversation.

Changes since 3.0.0: https://github.com/TreyU23/Live-Desktop/compare/v3.0.0...v3.0.1
