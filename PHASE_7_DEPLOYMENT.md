# Phase 7 — Deploy the split APIs

The database and its five tables already exist.

## Public API Worker

Deploy `worker-public/` from GitHub as:

- Worker name: `fluencycards-api`
- Root directory: `worker-public`
- D1 binding name: `DB`
- D1 database: `fluencycards`
- Do not protect this entire Worker with Cloudflare Access.

Public routes:

- `/api/health`
- `/api/catalog`
- `/api/analytics/batch`

## Private Admin Worker

Deploy `worker-admin/` from GitHub as:

- Worker name: `fluencycards-admin-api`
- Root directory: `worker-admin`
- D1 binding name: `DB`
- D1 database: `fluencycards`
- Environment variable: `ADMIN_EMAIL`
- Protect this Worker with Cloudflare Access.

Private routes:

- `/api/health`
- `/api/admin/summary`
- `/api/admin/course/validate`
- `/api/admin/course/import`
- `/api/admin/review`
- `/api/admin/analytics/overview`

## Worker secrets

Add only to the private admin Worker as needed:

- `OPENROUTER_API_KEY`
- `GOOGLE_API_KEY`
- `OPENAI_API_KEY`

No LLM API key belongs in the public Worker or student PWA.
