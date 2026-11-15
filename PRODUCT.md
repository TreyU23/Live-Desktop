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

The Apple-style glass direction (selected 2026-11-14, replacing Flight Deck V2) is current: near-black wallpaper with glass cards, a floating sidebar that becomes a bottom tab bar on phones, an Overview widget grid led by the PC instruments, and all seven views. Reduced transparency (system setting or Settings switch) returns to true black with solid surfaces. Refine within this direction. [Design contract](DESIGN.md), [selected reference](docs/redesign/README.md).

## Evidence on Hand

Current source, scripts and READMEs define behavior. Generated artwork/readings are illustrative. Browser fixtures verify presentation; accounts, hardware and distribution require separate validation.

## Product Principles

Show PC state first; make action scope/availability explicit; preserve current functions and user data; never infer health from missing readings.

## Open Decisions

- One-shot approvals: the backend treats every approval as a reusable scope (`ActionService.hasPreviousApproval`). The approval sheet therefore offers **Allow** with an explicit “also allows matching requests later” notice, not the reference's *Allow Once* switch. Adding one-shot approval is a backend policy change to decide separately.
- Approvals carry no conversation id, so the sheet opens for requests that appear while Conversations is open rather than for “this conversation”.

[Validation](docs/VALIDATION.md) records automated/manual boundaries. Local implementation does not authorize publication.
