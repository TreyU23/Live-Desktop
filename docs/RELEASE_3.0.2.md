# Live Desktop 3.0.2

Security and reliability release. It fixes seven problems found in the 3.0.0 release review: the assistant could change the files that run Live Desktop, two approvals covered far more than the user saw, two `.env` files could override fixed security settings, the dashboard could be framed by other sites, any local page on port 4173 could ask the backend for its API token, and the saved state grew without limit. The interface is unchanged apart from clearer approval text.

## Fixes

- **The assistant can no longer write to Live Desktop's own files** ([#2](https://github.com/TreyU23/Live-Desktop/issues/2)). Writes are refused in `data`, `native`, `backend`, `frontend`, `scripts`, `.tools`, `.git`, `.github` and `.mvn`, for every `.env` and `.env.*` file, and for executable or script types such as `.cmd`, `.bat`, `.ps1`, `.exe`, `.dll` and `.jar`. Tricks such as trailing dots or spaces, 8.3 short names and alternate data streams are refused too. Approving a file write now covers only that path with that exact content, and a failed action no longer counts as an approval.
- **Approving one memory no longer approves the rest** ([#5](https://github.com/TreyU23/Live-Desktop/issues/5)). A memory approval now covers only that category with that exact text. Memories the assistant recalls are marked as untrusted data in its prompt.
- **A second `.env` is no longer loaded** ([#3](https://github.com/TreyU23/Live-Desktop/issues/3)). Only the `.env` in the installation folder is read; `backend/target/.env` is ignored.
- **`.env` can no longer change the fixed backend settings** ([#7](https://github.com/TreyU23/Live-Desktop/issues/7)). The launcher passes the bind address, port and workspace root on the command line, which outranks any `.env` value. `DATA_DIR` stays configurable.
- **Other sites can no longer frame the dashboard** ([#4](https://github.com/TreyU23/Live-Desktop/issues/4)). The page host sends `X-Frame-Options: DENY` and `frame-ancestors 'none'` as real response headers.
- **Another local page can no longer fetch the API token** ([#8](https://github.com/TreyU23/Live-Desktop/issues/8)). The launcher creates a secret for each launch, and the backend gives out its token only to a caller that presents it. Only the page host does. Calling the backend on port 4317 directly no longer returns a token in the packaged app. Development runs without the secret behave as before.
- **The saved state stays small and quick** ([#9](https://github.com/TreyU23/Live-Desktop/issues/9)). A finished file write keeps only its path, a hash and its size instead of the full content. At most 1,000 finished actions are kept. The state file is compact JSON, and each profile has its own lock.

## Compatibility

No data migration. Existing state files are trimmed automatically the first time they load. Ports, the local API and storage format are unchanged. Two behaviors change on purpose: a file write the assistant repeats with different content asks for approval again, and scripts that read the token from `http://127.0.0.1:4317/health` in the packaged app must use `http://127.0.0.1:4173/health` instead.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v3.0.2). Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

The same archive is published as `com.localassistant:live-desktop-windows-x64:3.0.2:zip`. See [package documentation](PACKAGES.md).

## Not included

The assistant's workspace is still the installation folder. Moving it to a separate folder (the lasting fix suggested in #2) and checking profile IDs against a known list are not part of this release.

## Evidence limits

The Java changes are covered by new automated tests. The launcher and page-host changes (secret, headers, command-line settings) are C++ and were checked by review and by the Java side of the same behavior, not by an automated end-to-end run of the packaged app.

Changes since 3.0.1: https://github.com/TreyU23/Live-Desktop/compare/v3.0.1...v3.0.2
