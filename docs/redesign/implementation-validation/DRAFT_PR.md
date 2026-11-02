# Implement Flight Deck across the Live Desktop dashboard

Replace the dashboard presentation with the planned PC-first Flight Deck layout across all seven views. A reserved bottom dock keeps navigation clear of content; narrow windows expose secondary views in More. Add truthful resource instruments/freshness, complete reusable approval-scope details, local memory filtering, read-only agenda expansion, phone details, draft-preserving assistant entry, and keyboard-contained confirmations.

Keep API routes, scheduler cadence/invalidation, profile isolation, protected credentials, native execution and persistent provider iframe behavior intact. Preserve saved appearance while adding contrast-aware custom accent rendering. The Java/native source contracts are unchanged.

Validation: 28 frontend tests, Vite/Sites packaging, 42 browser view/viewport combinations, mutation races, polling/iframe/profile regression, 10 native host checks, backend package (51 tests, one intentional skip), and isolated runtime/lifecycle smoke passed. See [validation](README.md) for exact scope and build-environment workarounds. Design review's two System Info findings were fixed and scored resolved.

The exact local distribution with bundled Java also passed extracted-package hashes, dashboard/backend smoke and lifecycle checks. Build stages were completed separately after the monolithic command hit restricted process behavior.

Remaining release gates: authenticated account/device checks, actual browser UI zoom/screen-reader verification, and formal Codex Security scan. Git branch/draft PR creation was blocked by read-only `.git` in the implementation session. This is a prepared PR body, not a remotely created pull request. Publication remains separately authorized.
