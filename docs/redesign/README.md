# Selected design reference: Apple-style glass

The [Apple-style redesign draft](https://claude.ai/artifact/PBWwVMJFTjGCUZjwv7TxUd) (four artboards: Overview, System Info, Conversations with the approval sheet, Settings) and its [migration plan](https://claude.ai/artifact/PL4Njszg4C7GQjVFwca7Tq) were implemented on 2026-11-14 as the only shell (no feature flag; git history is the rollback). Both links are private claude.ai artifacts; the artboards are not exported into this repository.

[DESIGN.md](../../DESIGN.md) is the contract and `frontend/src/styles/tokens.css` the runtime authority. Where the reference and the contract differ, the contract wins:

- Gauges and bars use utilization severity colors (with a severity-tinted glow), not the reference's always-blue arcs.
- Production uses Segoe UI Variable; the reference renders in Inter as a stand-in and loads it from Google Fonts, which production must not do.
- The reference's “Restart PC / Shut down PC” labels are wrong for this app: those controls restart or stop Live Desktop's services, never Windows.
- The approval sheet offers **Allow** with a reusable-scope notice instead of *Allow Once*, because the backend has no one-shot approval.
- Readings, device names, phone and calendar content in the reference are sample data, not telemetry or detected hardware.

## History

The [V2 Flight Deck reference](flight-deck-refinement/overview-concept-v2.png) informed the November 2, 2026 refinement (three-column true-black dashboard, top bar and bottom dock). It is superseded but retained as provenance with its [concept prompt](flight-deck-refinement/PROMPT-v2.txt) and [workstation asset prompt](flight-deck-refinement/WORKSTATION-PROMPT.txt); the generic workstation asset is still used on System Info. Regenerate synthetic implementation captures with [browser validation](../VALIDATION.md) rather than maintaining duplicate screenshot sets.
