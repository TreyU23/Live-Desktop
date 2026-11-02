# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Current visual direction

- Use the Flight Deck redesign in `../DESIGN.md` and `../docs/redesign/IMPLEMENTATION_PLAN.md`: PC overview first, instruments centered, controls left, connected services right, and reserved bottom navigation. The user authorized implementing the existing plan on November 1, 2026.
- Below 768 px, instruments precede controls and services; navigation exposes Overview, System Info, Conversations and More. More contains Music, Approvals, Memories and Settings. Preserve all seven view IDs.
- Keep one resource scheduler in App, mutation invalidation, profile request headers, and the persistent provider iframe. Views own presentation and drafts, never independent polling loops.
- Missing readings are unavailable, not zero. Approval details explain reusable scope, including both on and off for radios. Do not add voice input, calendar editing, or unsupported playback features.
- The application background is true black (`#000000`), never charcoal, navy, or a gradient.
- Use near-black raised surfaces, subtle separators, warm-white text, cobalt-blue controls, mint health states, and amber approvals.
- Preserve airy spacing and avoid a dense wall of bordered cards.
- Dashboard widgets must respond inside Live Desktop first; any action that opens a Windows app must be explicitly labeled as external.
- Keep frontend/backend restart and shutdown controls visible in the top bar, with a confirmation step for shutdown.
- Phone Link status should refresh automatically and on demand, using live local metadata instead of hardcoded notification or device details.
- The Phone Link illustration must reflect the linked platform: iPhone for Apple/iOS metadata, Android for Android metadata, and a neutral placeholder when the platform is unknown.
- Settings owns account connections and appearance preferences; true-black dark mode is the default, and theme plus preset/custom hex accent colors persist locally per profile. The Black accent renders as white in dark mode for contrast and as black in light mode.
- The top-bar profile icon opens a local profile picker. Profile identity, appearance, conversations, memories, approvals, API keys, and integration configuration must remain isolated by profile and stored only on this PC.
- The dashboard widget and full-window Music view use the original compact custom player design for either Apple Music or Spotify: album art, real track metadata, progress, and playback controls.
- Extra dashboard integrations must not require an additional paid developer program or paid API. Prefer local Windows capabilities and user-owned services.
- Settings owns a profile-scoped Apple Music/Spotify provider toggle. Keep one persistent embed for the selected provider, retain separate provider links for seamless switching, and use Windows Global System Media Transport Controls for real metadata and playback commands. Neither provider may require developer credentials; Apple Music must not request MusicKit credentials, a Team ID, Key ID, `.p8` key, or Apple Developer Program enrollment, and Spotify must not request an OAuth client or developer application.
- Preserve the compact calendar widget layout, but source its events from the user's iCloud Calendar through the local backend. iCloud credentials must use an Apple app-specific password, be protected with Windows DPAPI, and never be echoed back to the frontend.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
