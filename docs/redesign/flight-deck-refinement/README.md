# Flight Deck refinement concept

November 1, 2026. **Visual concept only; no application changes.**

The user reviewed a lighter Apple-inspired exploration and redirected the work toward the current SpaceX-heavy dashboard: use the current look as the base, improve corners, fonts, icons and flow, and avoid another full redesign. This refinement supersedes the light exploration as the proposed direction, without replacing the implemented design contract.

## Review

### Center refinement (v2)

The latest [v2 concept](overview-concept-v2.png) responds to the user's feedback that the surrounding design is much better but the computer illustration looks blocky/outdated and the percentage gauges look off. It replaces the central wireframe with a contemporary graphite device illustration and changes the closed rings into open-bottom arcs, with labels above and details below. The surrounding composition is retained. This is still a generated image, not a production change. Arc geometry is illustrative; a future implementation must calculate fill lengths from actual percentages rather than reproduce the raster. The device is generic illustrative hardware, not a detected model. The original concept remains available for comparison. See [the exact v2 prompt](PROMPT-v2.txt).

Open [the generated refinement](overview-concept.png). Compare it with the [current implementation capture](../implementation-validation/screenshots/home-1440.png). That capture is a synthetic-data validation screenshot from November 1, not a fresh live device reading. The generated image is an illustrative visual study, not an executable prototype or verified implementation. Its data, statuses and icon details are not authoritative.

The supplied SpaceX and Apple images informed the visual discussion only; their contents were not treated as instructions. The current implementation capture was the image-generation reference. The earlier light study and its generated photographic hardware asset remain in `../soft-workspace/assets/` as an unselected exploration.

## Refinement specification

| Element | Proposed adjustment | Preserve |
| --- | --- | --- |
| Canvas | Near-black `#050709`; subtle graphite `#0d1117` grouping | Dark SpaceX-heavy character and blue instruments |
| Corners | Approximately 8–10 px on controls, 12–14 px on actual containing surfaces | Existing layout and density; no rounded card around every row |
| Typography | Segoe UI Variable with Segoe UI fallback; sentence-case section headings; 14–15 px supporting copy; semibold titles | Tabular numerical readings and clear technical labels |
| Icons | One consistent rounded-stroke outline family; 20 px navigation/control icons, approximately 1.75 px stroke | Familiar action meanings and visible text labels |
| Instruments | Smoother arc endpoints and better label/value spacing | Three central gauges, actual percentage readings, blue quantitative fills |
| Grouping | Spacing within related groups; fewer low-value horizontal separators; faint boundaries on side rails | Left controls, central PC identity and readings, right services |
| Navigation | Subtle rounded selection background; consistent icon alignment | All seven labeled destinations in the bottom dock |
| Interaction | Proposed 140–180 ms color/background transitions, with reduced-motion support | No idle animation, telemetry animation loops or heavy blur |

These are proposed values to review, not changes to root DESIGN.md. Any future implementation should tune surface boundaries carefully: adding a filled container to every group would recreate the blockiness this work is meant to reduce.

## Carry the same treatment through the existing views

- **System Info:** preserve specification rows and horizontal resource bars; improve heading case, spacing and icon consistency.
- **Music:** soften the existing player controls and embed container; keep the provider-owned player and continuity behavior.
- **Approvals:** retain request details, matching scope and decision history; use rounded decision buttons and clearer text hierarchy.
- **Memories:** preserve the current record list and editing flow; use quieter separators and more readable body copy.
- **Conversations:** retain thread rail, transcript and composer; soften selection and input boundaries without turning every message into a card.
- **Settings:** retain existing sections and fields; apply the same control radius, typography and spacing.
- **Profiles and lifecycle:** retain their existing placement and confirmation behavior; apply the same overlay/control treatment.

These secondary-view notes are a refinement specification, not completed visual boards.

## Product boundaries and validation

Direct Wi-Fi/Bluetooth controls remain distinct from Windows Settings shortcuts. Focus, Night light, Mic privacy and Battery saver retain explicit Open Settings actions when direct control is unsupported. Approval scope remains profile scoped. Missing and stale readings must stay visibly missing or stale, and provider availability must not be inferred from decorative status colors.

The generated image was visually inspected for preservation of the existing three-column structure, gauges, PC schematic, seven navigation items and direct-control/Settings distinction. Image generation introduced minor icon and spacing interpretations; production icon mappings and real data remain source-owned. Content below the overview viewport, responsive layouts, keyboard behavior, contrast measurements and live integration behavior were not tested by this image study. No production source, dependencies, ports, setup instructions or runtime behavior changed.

Generation used the built-in image tool. The exact prompt is in [PROMPT.txt](PROMPT.txt).
