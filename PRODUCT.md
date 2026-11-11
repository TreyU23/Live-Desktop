# Live Desktop product context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

A local Windows dashboard prioritizing PC state, with approved controls, conversations, inspectable memories, calendar, phone status and music.

## Operating Context

React/Vite calls local Java APIs; Java owns profiles/persistence/integration and approval policy. C++ owns Windows execution and the production runtime. [Runtime/setup](README.md).

## Capabilities and Constraints

- Preserve all seven views, profile management and restart/shutdown controls.
- Profiles/credentials/state stay local and profile scoped; profiles are not authentication. OpenAI/iCloud/music use external services.
- Distinguish direct radio changes from approved Settings launches; never imply an unsupported toggle changed.
- Music uses a persistent selected-provider embed and Windows metadata, without developer credentials. Calendar uses protected iCloud app-specific passwords. Phone Link shows available local metadata.
- Preserve independent reads, freshness/error states, mutation guards and truthful missing readings. No voice input or calendar editing.

## Brand Commitments

The implemented Flight Deck V2 direction is settled: preserve the true-black composition, PC instruments, left controls, right services, reserved header/dock and all seven views. Refine within this direction. [Design contract](DESIGN.md), [selected reference](docs/redesign/README.md).

## Evidence on Hand

Current source, scripts and READMEs define behavior. Generated artwork/readings are illustrative. Browser fixtures verify presentation; accounts, hardware and distribution require separate validation.

## Product Principles

Show PC state first; make action scope/availability explicit; preserve current functions and user data; never infer health from missing readings.

## Open Decisions

No redesign decision is pending. [Validation](docs/VALIDATION.md) records automated/manual boundaries. Local implementation does not authorize publication.
