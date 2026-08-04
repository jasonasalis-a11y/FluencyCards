# Fluency Engine 0.9.4 — R2 Storage Migration

- Stores complete course JSON in the `fluency-engine` R2 bucket through `env.ASSETS`.
- Stores only course/version metadata, checksum, size, status, and R2 object key in D1.
- AI Review retrieves course JSON from R2.
- Adds publish workflow that copies approved JSON to `catalog/<course>/<version>/course.json`.
- Public API adds `GET /api/course/:course_id` and serves published JSON from R2.
- Admin UI can save validated drafts to R2, select saved versions for AI review, and publish a version.
- Rebrands Worker service labels and admin UI to Fluency Engine.

## Required database migration
Run `worker-admin/migration-0.9.4-r2.sql` once against the production `fluencycards` D1 database before importing a new draft.

Existing 0.9.3 versions are retained as metadata with status `legacy-needs-reimport`. Their old D1 JSON blobs are kept in the renamed backup table `course_versions_legacy_093` until you deliberately remove that table after verification.
