# Suggested GitHub Repository Layout

For the initial repository, keep one monorepo:

- `student/` — public PWA
- `admin/` — private hosted admin UI
- `worker/` — Cloudflare Worker and D1 schema
- `builder/` — Termux/local CSV and audio builder
- `courses/` — portable official course sources
- `docs/` — architecture and authoring documentation

A monorepo is simpler until the platform and course schema stabilize. Separate course repositories can be created later.
