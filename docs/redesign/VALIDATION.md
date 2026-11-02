# Concept validation

October 15, 2026. This records checks on the concept artifact, not the production application.

## Evidence

- Opened the current frontend on an isolated loopback development server to inspect its hierarchy. The real backend was offline, so its empty/offline rendering was observed; no hardware or account behavior was claimed. That temporary development server was stopped after inspection.
- Opened `concepts.html` in the Codex browser using the dedicated loopback preview on port 4175.
- Navigated all **14 concept boards** at a 1440×1000 desktop viewport. Verified the selected view/title and captured each full page under `screenshots/`.
- Checked every board for horizontal document overflow at 390×844. Found Music overflow, then fixed its grid sizing and wrapped playback controls.
- Rechecked Home, Music, Approvals, Memories, Settings, and Conversations at **both 390×844 and 320×844** after the fixes: no horizontal document overflow in those checks.
- Desktop checks found no unnamed buttons. Media icon buttons have accessible names. This is a targeted inspection, not a complete accessibility audit.
- Browser error/warning log inspection for the concept page returned no entries.
- Ran the Impeccable mechanical detector once. It flagged compact 11px text and tracking. Kept compact uppercase instrument labels as part of the supplied visual reference, and changed substantive paragraphs, approval scope, fields, chat, and notes to Segoe UI at 14px. Full production contrast, zoom, focus, and screen-reader validation remain required.
- An independent screenshot/source reviewer inspected the reference and representative desktop/mobile concepts. The initial verdict was FIX. All blocking findings were corrected: exact Wi-Fi permission scope; submitting versus backend status; duplicate assistant entry in Conversations; cramped mobile app rows; mobile Music overflow; substantive text sizing/font.
- The reviewer's follow-up verdict was **SHIP as a concept proposal**. Navigation reachability remained explicitly deferred to design lock: the gallery demonstrates the dock's appearance in document flow; production must keep it reachable at laptop heights and provide the approved narrow navigation behavior.
- Checked the documentation diff for whitespace using the repository's existing CRLF convention. No production source files were modified.

## Captures

Each of the 14 board IDs has a matching desktop PNG: `home`, `system`, `music`, `approvals`, `memories`, `conversations`, `settings`, `calendar`, `phone`, `profiles`, `activity`, `lifecycle`, `states`, `design`.

Additional captures: `home-mobile.png`, `approvals-mobile.png`, `settings-mobile.png`, `music-mobile.png`, and `music-320.png`. These are screenshots of the authored HTML artifact; they are not generated images or live Windows readings. The HTML is the editable authority for these concepts.

## Practical limitations

- Only concept navigation and the inert-button feedback are interactive. Forms are visual examples; they do not accept or transmit credentials. System actions, playback, profile changes, and destructive controls do not execute.
- The lower navigation remains in page flow for concept review. Sticky/reserved placement, a reduced mobile dock, and final viewport fit require approval and implementation.
- Light mode is retained in the implementation scope but is not rendered as a complete alternate concept in this pass.
- Provider embed content is a labeled placeholder. Authenticated music playback, iCloud sync, Phone Link, direct Windows operations, and runtime lifecycle behavior were not tested.
- Production tests/builds were not run for a documentation and standalone-concept change. The plan identifies the relevant suites for implementation.
- Pixel-perfect reference matching, exhaustive accessibility conformance, and production readiness are not claimed.
