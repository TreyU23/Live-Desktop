# Selected design reference: Astryx

The [Astryx concept screens](https://claude.ai/artifact/9dx9p5uB9nSpdurDAPTrVu) (18 artboards: every view plus the approval dialog and a phone-width Overview, dark and light) and the redesign plan (project doc `claude/astryx-redesign-plan.md`) were implemented on 2026-11-15, one commit per phase and per view on `Development` (no feature flag; git history is the rollback). The concept artifact is a private claude.ai artifact; its artboards are not exported into this repository.

[DESIGN.md](../../DESIGN.md) is the contract; the generated theme files under `frontend/src/themes/` are the runtime authority for tokens. Where the concepts and the contract differ, the contract wins:

- The concepts render in Figtree from Google Fonts; production uses Segoe UI Variable and loads no web fonts.
- Approvals adds an expandable row with the full content and reusable scope beside the concept's inline **Don’t Allow** / **Allow**, so a file write is never allowed unseen.
- Memories keeps **Add memory** (in a dialog); the concept dropped it.
- Gauges and sparklines draw severity with the `--color-icon-*` tokens; the concepts' plain warning yellow is about 1.5:1 on a light card.
- The orange accent preset is `#c4650f`, darker than the first theme's `#d57113`, to keep 3:1 on the light background.
- Readings, device names, threads, calendar and phone content in the concepts are sample data, not telemetry or detected hardware.

## History

- **Apple-style glass** (2026-11-14 to 2026-11-15): [draft](https://claude.ai/artifact/PBWwVMJFTjGCUZjwv7TxUd) and [migration plan](https://claude.ai/artifact/PL4Njszg4C7GQjVFwca7Tq); superseded by Astryx. Its glass tokens, Reduce transparency and the generic workstation art on System Info are gone.
- **Flight Deck V2** (2026-11-02): the [V2 reference](flight-deck-refinement/overview-concept-v2.png), [concept prompt](flight-deck-refinement/PROMPT-v2.txt) and [workstation asset prompt](flight-deck-refinement/WORKSTATION-PROMPT.txt) are retained as provenance.

Regenerate synthetic implementation captures with [browser validation](../VALIDATION.md) rather than maintaining duplicate screenshot sets.
