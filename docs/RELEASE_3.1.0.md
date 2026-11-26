# Live Desktop 3.1.0

Model release. The assistant moves from GPT-5.6 Sol to OpenAI's GPT-6.2 Sol, and each profile can now switch the assistant to Anthropic's Claude Sonnet 5.5 instead.

## What's new

- **GPT-6.2 Sol is the new OpenAI default.** `OPENAI_MODEL` now defaults to `gpt-6.2-sol` (was `gpt-5.6-sol`). If your private `.env` still sets `OPENAI_MODEL=gpt-5.6-sol`, delete that line or change it, because the `.env` value wins over the default.
- **Claude Sonnet 5.5 as a second provider.** Settings → Assistant → **Model** switches between GPT-6.2 Sol (OpenAI) and Claude Sonnet 5.5 (Anthropic). The choice is saved per profile, and conversation history carries over, so the next message in any chat goes to the model you picked.
- **A separate key for each provider.** Settings has an **Anthropic API key** row next to the OpenAI one. Anthropic keys (`sk-ant-…`, from the Anthropic Console) are protected with Windows DPAPI like the OpenAI key and never sent back to the browser. Pasting an Anthropic key into the OpenAI field (or the other way round) is rejected with a message saying which field it belongs in.
- **Same tools and approvals on both.** Claude gets the same system prompt, the same seven tools, the same approval rules, the same 240-second deadline and the same 8-round tool limit as GPT. Claude Sonnet 5.5 runs with adaptive thinking at `medium` effort (`ANTHROPIC_EFFORT`).
- **Provider-aware wording.** The chat banner, composer note, Connections card and System Info show which provider your messages go to and whether its key is set.

## Configuration

New optional `.env` settings (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `ASSISTANT_PROVIDER` | `openai` | Provider for profiles that haven't picked one in Settings |
| `ANTHROPIC_API_KEY` | empty | Default-profile fallback for the Anthropic key |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Anthropic model identifier |
| `ANTHROPIC_EFFORT` | `medium` | Claude effort level |

## API changes

- `GET /health` now returns `status`, `provider` and `assistantConfigured` (replacing `openAiConfigured`).
- `GET /api/profile/settings` returns the active `provider`, `assistantConfigured`, key status for both providers and the model each one uses.
- New: `POST /api/profile/assistant-provider` (`{"provider":"openai"|"anthropic"}`) and `POST`/`DELETE /api/profile/anthropic-key`. The key routes now return the full settings object.
- `POST /api/chat` without a key for the active provider returns `503` with code `assistant_not_configured`.
- New error codes: `anthropic_unauthorized`, `anthropic_forbidden`, `anthropic_rate_limited`, `anthropic_overloaded`, `anthropic_error`, `anthropic_unreachable`.

## Security notes

The Anthropic integration uses the JDK's HTTP client against the fixed `https://api.anthropic.com/v1/messages` endpoint, so no new third-party dependency ships. Redirects aren't followed, the key is sent only in the `x-api-key` header, and when a request fails only the documented `error.type` field is read. Anthropic's error text never reaches the UI or the model. Both keys stay profile scoped, and only the original profile falls back to environment keys.

## Compatibility

No data migration. Existing OpenAI keys, conversations, memories and approvals are untouched, and profiles stay on OpenAI until you switch them. Any script that reads `openAiConfigured` from `/health` should read `assistantConfigured` instead.

## Install or upgrade

Download `Live-Desktop-windows-x64.zip` and its `.sha256` from the [release](https://github.com/TreyU23/Live-Desktop/releases/tag/v3.1.0), then check it against the signed tag:

```powershell
.\scripts\verify-release.ps1 -Zip .\Live-Desktop-windows-x64.zip -Tag v3.1.0
```

Shut down the running instance, back up `data/` and any private `.env`, extract the complete `Live-Desktop` folder to a writable directory private to your Windows account, restore your data, run `start.cmd`, and open `http://localhost:4173`. Windows 10/11 x64 is required; Java 21 is included.

Once the release is published, the same archive is available as `com.localassistant:live-desktop-windows-x64:3.1.0:zip`. See [package documentation](PACKAGES.md).

## Evidence limits

The full backend suite passed on Windows (126 tests, 0 failures, 1 skipped), including new tests for the Claude request loop (tool rounds, thinking signatures passed back, error mapping, retry on overload), provider selection and per-provider key storage. The frontend unit tests (31/31), browser layout test (42 view/viewport combinations) and contrast test passed. The Settings changes were checked by eye in light and dark at 1440 and 390 px. Neither provider was called with a real key, so live GPT-6.2 Sol and Claude Sonnet 5.5 replies still need a manual check. The packaged app wasn't run by hand.

Changes since 3.0.4: https://github.com/TreyU23/Live-Desktop/compare/v3.0.4...v3.1.0
