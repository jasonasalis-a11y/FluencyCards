# FluencyCards v0.9.2

This release separates the backend into two Cloudflare Workers.

## Structure

- `student/` — public offline-first PWA
- `admin/` — private hosted admin interface
- `worker-public/` — public catalog and analytics API
- `worker-admin/` — private administration and AI-review API
- `builder/` — local Termux builder
- `courses/` — portable course sources
- `docs/` — architecture and course-format documentation

## Security boundary

The public Worker accepts student analytics and serves public course metadata.

The private Worker handles course imports, AI review, publishing, and analytics dashboards. Protect it with Cloudflare Access. Store LLM API keys only as private Worker secrets.

See `PHASE_7_DEPLOYMENT.md` for deployment instructions.
