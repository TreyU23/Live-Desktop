# Flight Deck dashboard redesign

## New refinement study — November 1, 2026

The [Flight Deck refinement concept](flight-deck-refinement/README.md) explores softer corners, clearer typography, consistent outline icons and quieter grouping while preserving the current SpaceX-heavy composition. It is a generated visual study and specification only, with no production changes. After reviewing a lighter Apple-inspired exploration, the user chose refinement of the current dashboard rather than another full redesign.

Original design study dated October 15, 2026; implementation authorized November 1, 2026. **Flight Deck is now implemented in the local frontend. The gallery remains an illustrative reference.** The user requested a redesign of the entire dashboard using the supplied SpaceX vehicle-overview reference and confirmed **PC overview first**.

## Review the concepts

Open [concepts.html](concepts.html) directly in a browser. It is self-contained, works without the Live Desktop backend, makes no API calls, and stores no data. Choose a board using the concept selector or use the dashboard navigation. Other buttons show a concept-only notice. All readings, event names, memories, conversations, profile examples, and media metadata are illustrative.

For a local preview from the repository root:

```powershell
node docs/redesign/preview.mjs
```

The optional preview requires Node.js and listens only on `http://127.0.0.1:4175`. It serves only the concept page. It does not replace the dashboard on 4173 or the backend on 4317. Stop its terminal process when finished. Node remains unnecessary for the production runtime.

Use [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the design intent, source mapping, visual system, and scope. It was expanded on November 1, 2026 into a full implementation plan with an [18-package execution backlog](EXECUTION_BACKLOG.md): concrete file targets, dependencies, behavior contracts, acceptance criteria, PR sequence, test commands, and rollback/release requirements. The seven-view implementation now lives in `frontend/src/`; see [implementation validation](implementation-validation/README.md) for evidence and outstanding release gates. [VALIDATION.md](VALIDATION.md) remains the historical record of checks on the concept artifact only.

## Concept coverage

| Board | Application surface |
| --- | --- |
| System overview | Home: resource gauges, PC identity, controls, integrations, agenda, phone, music, recent applications, assistant entry |
| System Info | Hardware and Windows specifications, resources, copy details |
| Music | Custom player, provider embed boundary, continuity and status |
| Approvals | Pending queue, request details, reusable capability scope, decision, history |
| Memories | Categorized local records, creation, deletion, draft/error behavior |
| Conversations | Thread rail, readable transcript, composer, profile and action context |
| Settings | OpenAI, iCloud, music provider/link, appearance, local profile ownership |
| Calendar / expanded day | Proposed enlargement of the existing Home calendar module |
| Phone Link / expanded panel | Device status, metadata, private-content boundary, external app action |
| Local profiles | Top-bar panel anatomy: switch, create, rename, photo, eligible delete |
| Recent activity / expanded list | Home application list and expanded details |
| Runtime controls | Shutdown confirmation, restart, failure and stopped states |
| Loading, errors & empty states | Resource-level states and mutation feedback |
| Design system | Proposed color, type, geometry, spacing, controls and motion |

Calendar, Phone Link, profiles, and activity are isolated on boards to review their anatomy. They are **not proposed additional primary navigation destinations**. The concept selector is review tooling, not part of the production application.

## Scope of this change

- Added a concept gallery and implementation plan; recorded confirmed product context in the root `PRODUCT.md`.
- Replaced production presentation with Flight Deck across all seven views, shared instruments, resource feedback, responsive navigation and supporting panels. API contracts, ports, backend approval policy, scheduler ownership, credential protection and integration boundaries are preserved.
- No generated imagery or copied SpaceX branding. PC and phone schematics are original SVG geometry. The album-art placeholder is explicitly labeled.
- The supplied image is treated as visual evidence only. No instructions or product claims are imported from it.
- [DESIGN.md](../../DESIGN.md) and its metadata describe the implemented tokens and components. Publication and live-account/package checks remain separate acceptance gates.

## Recommended review order

1. System overview: confirm information density, instrument size, left controls/right services, and lower navigation.
2. Approvals and Conversations: check that the visual language handles decisions and long text as well as telemetry.
3. Settings, profiles, and lifecycle: confirm that important controls remain discoverable.
4. Narrow-layout overview and state board: check how the hierarchy behaves outside the ideal desktop state.
5. Review recorded validation limits and complete the remaining release gates before publication.
