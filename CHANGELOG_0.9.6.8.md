# Fluency Engine 0.9.6.8 (PWA)

- The "Download / Update" button now reflects real state instead of always
  saying the same thing: shows "⬇ Download Full Course" (prominent) when
  nothing's installed yet, "⬆ Update Course" (prominent) when a newer
  version is published, and a disabled, grayed-out "✓ Course Up To Date"
  when the installed version already matches the latest published version.
  Pressing it no longer re-downloads over the network when nothing's
  changed — the version check happens before the fetch, not just after.
- After a successful download, the app now also saves a real backup copy
  of the course package to the device's Downloads folder (a normal browser
  file download, outside any web storage the site controls). This is the
  one thing that actually survives a user manually clearing site
  data/cache — Cache Storage and IndexedDB are wiped together by that
  action, so nothing kept inside the site's own storage can protect
  against it.
- Added "Restore from saved file" (small link in the lesson header): lets
  someone reinstall a course entirely offline from a previously saved
  backup zip, no network required, as long as no newer version has since
  been published.
- Calls `navigator.storage.persist()` after every successful install, to
  reduce the chance the browser silently evicts cached course data under
  device storage pressure — this was previously not requested at all,
  meaning offline course data was more vulnerable to automatic eviction
  than necessary on low-storage devices.
- **Offline resilience, beyond just this scenario:** `openCourse()` previously made
  an unconditional network call to `/api/catalog` even to open an *already-installed*
  course — meaning opening a downloaded course while offline was broken in the normal
  case, not just after a site-data wipe. Both this and the catalog list fetch now
  degrade gracefully instead of crashing.
- When the app can't load a course list at all (offline + no cached catalog — e.g.
  after site data was cleared), it now shows a dedicated "You're Offline" screen with
  a single prominent "Restore From Saved File" action, instead of a blank/broken
  screen. True zero-tap automatic detection of a file sitting in the Downloads folder
  isn't something any web app can do (no browser grants that ambient filesystem
  access, and even newer permission-persistence APIs would themselves live in site
  storage that a data-clear wipes) — this is the closest real equivalent: one tap,
  surfaced exactly when needed.
- Restore now works with zero prior context — the course's own identity is read
  directly from `course.json` inside the backup zip, so restoring doesn't require the
  app to already know which course you're restoring.
- Opening a specific course that isn't downloaded, while offline, now shows a clear
  "Course Unavailable Offline" message with its own restore-from-file option, instead
  of silently failing.
- When the device regains connectivity: if browsing the course list/offline screen,
  it's automatically retried; if mid-lesson, the app quietly re-checks for a newer
  published version in the background and updates the download button state, without
  interrupting whatever card is on screen.

No database migration required. No admin or worker changes in this
release — `student/index.html` only.
