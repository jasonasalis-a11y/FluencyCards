# Fluency Engine 0.9.6.9 (PWA)

- Adds a built-in, network-independent error overlay: any uncaught JavaScript
  error or unhandled promise rejection anywhere in the app now displays
  directly on the page (red banner, dismissible) instead of failing silently.
  No devtools, no Eruda, no network required to see it — exists specifically
  for debugging while offline, which is where this class of bug is likeliest
  to surface and hardest to diagnose otherwise.
- Fixes a real, separate bug found via code review in `student/sw.js`: the
  service worker's cache name was hardcoded to `fe-shell-0.9.6.6` and was
  never bumped across the 0.9.6.7 or 0.9.6.8 releases. Combined with a pure
  cache-first strategy for the app shell (`index.html`), this meant a
  browser that had ever cached the shell could theoretically keep serving
  old app code indefinitely, with no mechanism to ever pick up new code.
  Fixed: the shell (navigation requests + index.html/manifest) now uses
  network-first-with-cache-fallback, so online users always get current
  code and offline users still get the last-known-good version. Course
  content (JSON/audio/images) is unaffected — that stays cache-first,
  exactly as before. Old shell caches are automatically cleaned up on each
  new `SHELL_VERSION`, which must be bumped by hand on any future release
  that touches `index.html` or `manifest.webmanifest`.
- Not confirmed to be the direct cause of the reported "renders fine, no
  button responds" bug — the rendered page already reflected 0.9.6.8's UI,
  which rules out stale shell code as the explanation for that specific
  symptom. Fixed regardless because it's a real, independently serious
  defect for an offline-first app. The error overlay above is what will
  actually reveal the real cause next repro.

No database migration required. No admin or worker changes in this release —
`student/index.html` and `student/sw.js` only.
