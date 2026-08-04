# Fluency Engine 0.9.4.1

- Fixes the admin authorization deadlock when Cloudflare Access has not yet been configured.
- Accepts Schema 1.0 courses using `title.learning`, `title.native`, `skills`, and `activities`.
- Serves the PWA from the public Worker root URL.
- Connects the PWA to `/api/catalog` and `/api/course/:course_id`.
- Shows a clear empty-catalog screen until a course is published.
