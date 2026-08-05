# Fluency Engine Admin v0.9.6.2 Stabilization

Admin-only stabilization release. The public PWA is intentionally unchanged.

## Fixes

- Fixes Cloudflare Error 1101 on provider test and full AI review by awaiting asynchronous route handlers so rejected promises are caught and returned as JSON.
- Keeps all provider failures inside structured JSON responses with stage, provider, model, endpoint, HTTP status, request ID, and safe key metadata.
- Changes Gemini REST calls to the stable `v1` `generateContent` endpoint.
- Makes **Test provider** a minimal connectivity test without structured-output requirements.
- Keeps full reviews structured for Google, OpenAI, and OpenRouter.
- Fixes false duplicate-item errors by validating identifiers within their defining collection instead of combining skills, cards, activities, and assessments into one global item namespace.
- Preserves AI review as a non-blocking publication warning.
- Preserves required audio as a blocking publication requirement.

## Expected acceptance result for the current test course

- Audio: 26 present, 0 missing.
- Duplicate-item errors: none.
- Missing AI review: warning only.
- `can_publish`: true when no other genuine validation errors exist.
