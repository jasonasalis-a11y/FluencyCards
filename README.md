# FluencyCards v0.9.1

This release changes the production architecture to a hosted Cloudflare admin while preserving the local Termux builder.

## Included

- Existing student PWA and offline lesson downloader
- Offline analytics queue and online synchronization
- Hosted private admin web app
- Cloudflare Worker API
- D1 schema for courses, immutable versions, analytics, review runs, and audio metadata
- Bulk portable-course import
- Multi-provider AI review
- Analytics dashboard endpoints
- Cloudflare Access-compatible admin authorization
- Local builder and CSV course source retained
- Portable course-package documentation

## Important

This is a deployable architecture package, but it cannot configure your Cloudflare account automatically. After you create the GitHub repository, connect the projects and create the D1 database using `worker/schema.sql`.

Store API keys as Worker secrets:

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GOOGLE_API_KEY
wrangler secret put OPENAI_API_KEY
```

Protect the admin and administrative API routes with Cloudflare Access.
