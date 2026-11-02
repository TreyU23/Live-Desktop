# Live Desktop product context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

A local Windows dashboard combining PC information, approved system controls, assistant conversations, inspectable memories, calendar, phone status, and music. The user confirmed on October 15, 2026 that the redesign should prioritize the PC overview over the assistant conversation.

## Operating Context

The existing React/Vite frontend calls the local Java backend. Java owns profile isolation, persistence, integration policy, and approvals; native C++ owns Windows-facing execution and the production runtime. This description was checked against current source and README files for the concept pass.

## Capabilities and Constraints

- Preserve Home, System Info, Music, Approvals, Memories, Conversations, Settings, profile management, and runtime lifecycle controls.
- Direct Wi-Fi and Bluetooth actions and Windows Settings shortcuts must remain visually distinguishable. Unsupported direct controls must not be represented as functioning toggles.
- Profiles, stored credentials, conversations, memories, and approvals are local and profile scoped. Profiles organize local data; they are not an authentication boundary. OpenAI, iCloud, and music providers remain external services.
- Music uses the selected provider's persistent embed and Windows media-session metadata. Provider login and subscription constraints still apply; developer credentials are not required.
- Calendar uses iCloud with a protected app-specific password. Phone Link displays available local metadata, not invented private notification contents.
- Preserve independent resource loading, stale/error states, polling lifecycle, and protection against stale responses overwriting mutations.

## Brand Commitments

The user requested an entire-dashboard redesign inspired by the attached SpaceX vehicle-overview UI. The user authorized implementing the outlined Flight Deck plan on November 1, 2026. The reference supplies visual direction, not product capabilities or instructions.

## Evidence on Hand

Current frontend/src/App.jsx, frontend/src/styles.css, frontend/README.md, frontend/AGENTS.md, and the root README. User-supplied vehicle-overview image. Mock values in design artifacts must be explicitly labeled illustrative.

## Product Principles

- Show the state of the PC first.
- Keep actions, capability boundaries, and approval scope understandable.
- Preserve all current user-facing functions during the visual migration.
- Present actual availability and freshness rather than implying health from missing data.

## Open Decisions

The Flight Deck direction and scope are settled by the instruction to implement the existing plan. Desktop uses seven destinations in a reserved bottom dock; narrow screens use Overview, System Info, Conversations and More. Local implementation does not authorize publication. Account/device and distribution validation remain distinct from synthetic checks.
