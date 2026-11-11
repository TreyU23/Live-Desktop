# Project-wide maintenance instructions

- Follow `docs/PROJECT-WORKING-GUIDE.md` (also mirrored as the always-applied Cursor rule `.cursor/rules/project-working-guide.mdc`) for development, design, security, validation, and release work in this repository. Source, scripts, and current documentation govern implemented behavior; historical validation is not evidence for a new change.
- Treat README maintenance as part of every adjustment. Before finishing any code or configuration change, check whether user setup, prerequisites, environment variables, commands, ports, integrations, security behavior, or troubleshooting steps changed. Update the relevant root/backend/frontend README in the same change whenever they did.
- Keep setup documentation aligned with the scripts and the behavior that is actually running. Remove superseded setup paths rather than leaving them as alternatives.
