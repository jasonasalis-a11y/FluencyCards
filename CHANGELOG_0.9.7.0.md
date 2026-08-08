# Fluency Engine 0.9.7.0 (PWA)

- Adds a proactive warning banner (dismissible per page-load, not permanently) for
  browsers known to wipe all site data on close — Firefox Focus, Firefox Klar, and
  DuckDuckGo Privacy Browser at launch. These browsers are fundamentally incompatible
  with offline course access as a matter of design, not a bug on our end: closing the
  browser destroys the downloaded course, all progress, and the Service Worker itself,
  every single time. The banner tells the person this up front and recommends Chrome,
  rather than letting them discover it the hard way after losing progress.
- Detection is user-agent based against a small, maintained allowlist — this can only
  warn about browsers we know about. A new privacy-focused browser we haven't added
  yet would slip through silently. Worth revisiting this list periodically rather than
  treating it as complete.
- Confirmed via real device testing (both Chrome's per-site "Clear & reset" and
  Firefox Focus's close-to-wipe behavior) that the restore-from-file flow itself
  (`restoreFromFile`/`installPackageBytes`) makes no network calls of any kind — it
  operates purely on the picked File object. Connectivity cannot affect whether that
  code path works, by construction. Also confirmed: a from-scratch "Service Worker
  registration itself was wiped, zero network" state is not something any PWA can
  recover from with in-app code — the browser's own native error page is shown before
  any of our JavaScript gets a chance to run. This is a hard platform limit, not
  specific to this app.

No database migration required. No admin or worker changes in this release —
`student/index.html` only.
