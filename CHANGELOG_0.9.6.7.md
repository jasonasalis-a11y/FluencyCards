# Fluency Engine 0.9.6.7 Stabilization (PWA)

- Fixes conversation activities being split into one card per phrase. A conversation
  activity is now flattened into a single queue item carrying all turns, and the
  player renders it as one dialogue thread (all turns visible, each with its own
  Listen button, plus a "Play Whole Conversation" control) instead of forcing the
  learner through N separate "cards."
- Fixes the recording UI never appearing on `introduce` activities authored with
  `"recording": true`. `flatten()` was silently dropping `recording`, `icon`,
  `mastery_domain`, and `required_for_mastery` for this activity type. These cards
  now show a "Record Yourself" / "Play My Recording" control, matching what course
  authors intended.
- Preserves `mastery_domain` and `required_for_mastery` through `flatten()` for all
  activity types (`introduce`, `recall`, `conversation`, `multiple_choice`), so the
  currently-unwired `mastery-engine.js` module will receive correct data whenever
  it's connected to the player.
- Updates `tests/player-routing.test.js` expectations, which had encoded the old
  one-card-per-turn behavior as the "correct" spec.

## Known gap (not fixed in this release, flagged for visibility)
`tests/activity-contract.test.js` and `tests/player-routing.test.js` reference
`tests/fixtures/English_for_Khmer_v0.9.4_importable.json`, which is not present in
the repository. That fixture also appears to be from a different course revision
than what's currently checked in (it expects 3 `multiple_choice` activities; the
current `courses/english-for-khmer/course.schema-1.0.json` has 0). Both tests
currently fail with ENOENT for this reason — confirmed to be pre-existing, not
caused by this release. No fixture was fabricated to paper over this; recommend
either committing the real fixture or updating the tests to read from the actual
course file.

No database migration is required. No admin or worker changes in this release —
`student/index.html` only.
