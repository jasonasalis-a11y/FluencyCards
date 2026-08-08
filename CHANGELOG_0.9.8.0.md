# Fluency Engine 0.9.8.0 — Learning Core

The mastery & review system, phonics cards, content flagging, and local
streaks/badges from the roadmap's "Learning Core" milestone, plus a new
5-lesson test course to actually exercise all of it.

## Fixed
- The CSS grid overlap bug found testing in Firefox Focus (`.lesson-shell` had
  4 defined rows for 5 actual elements after the restore-link was added in an
  earlier release). Now correctly sized.
- **Real latent bug, unrelated to this build's scope, found while touching this
  code:** the lesson title shown in the header was hardcoded to always read
  `course.lessons[0]`, regardless of which lesson was actually on screen. With
  every prior course being exactly one lesson long, this was invisible. It
  would have shown the wrong title for lesson 2 onward the moment a
  multi-lesson course existed — which this release introduces. Fixed to look
  up the correct lesson via the card's own `lesson_id`.

## Added — Mastery & review system
- New IndexedDB database (`fe-mastery`) tracking per-card results (`cards`
  store), per-lesson pass state (`lessons` store), module review history
  (`moduleReviewSessions`), and mastery-engine state (`lessonMasteryStates`).
- Recall cards now require both rating axes (confidence × pronunciation) to
  pass; multiple-choice requires the correct answer. Passing/failing criteria
  match what was specified: `knew`/`hesitated` + `great`/`good` = pass.
- **End-of-lesson review**: on reaching the end of a lesson, any not-yet-passed
  scored cards are re-presented in a loop until all pass, then the lesson is
  marked passed.
- **End-of-module review**: on passing the last lesson in a module, all
  ever-failed cards from that module are re-tested, padded with a
  pseudo-random sample of never-failed cards to reach a 35% floor of the
  module's total scored cards (capped at 100% if failure rate alone already
  exceeds 35%) — matches the spec exactly; verified against the actual
  formula in isolation (10%-failed → still reviews 35%; 50%-failed → reviews
  50%; 100%-failed → reviews 100%).
- Introduce and conversation cards remain unscored, as specified. Phonics
  `introduce` is unscored; phonics `recall` is scored using the same
  dual-rating system as vocabulary recall.

## Added — mastery-engine.js, wired in alongside the above (not replacing it)
- `student/mastery-engine.js` existed but was never connected to anything.
  Its domain/skill-ratio + long-term retention audit model is a genuinely
  different (and complementary) concept from the immediate card-level review
  above, so both now run side by side: every scored result feeds both
  systems.
- **Real bug found and fixed during integration**: the engine's own
  `evaluateLesson()` uses a *cumulative* go/no-go ratio per domain across the
  whole lesson — meaning after a single mistake, that domain's ratio can
  mathematically never return to a 100% threshold within the same lesson, no
  matter how many subsequent attempts succeed. Verified this in isolation
  before shipping. Fix: the card-level system (which already gates lesson
  completion) now directly marks the mastery-engine lesson state as
  `mastered` when a lesson passes, rather than depending on the ratio-gate
  ever resolving true on its own. This also means `initial_mastery_at` now
  actually gets set, which is required for anything to become audit-eligible
  — without this fix, the audit feature below would have silently never had
  any candidates, ever.
- **Retention audit**: `generateAudit()`'s output (sampled previously-mastered
  skills, using each skill's authored `retraining_activity_ids`) is now
  rendered as a real review screen, reusing the existing card renderer — no
  new UI needed since the IDs point at real, already-renderable activities.
  Triggered by `audit_policy.every_n_lessons`, checked whenever a lesson is
  cleared and it's *not* also the end of a module (a deliberate simplification
  to avoid stacking two review types back-to-back in this release — worth
  revisiting later if that ordering ever feels wrong in practice).
- Fixed a real, separate gap in the existing schema: `multiple_choice`
  activities had no `mastery_domain`/`skill_ids` at all in the original
  Khmer course, meaning the required "comprehension" domain could never be
  satisfied. The new course's multiple-choice cards are properly tagged.

## Added — Phonics card type
- New `phonics` activity type, `introduce` and `recall` variants, rendered and
  wired consistently with existing card patterns (recall variant reuses the
  same dual-axis rating UI as vocabulary recall).
- `prompt_language` field on `recall` activities (`native` default, or
  `learning`) — lets later-course recall cards prompt with the target-language
  text instead of native, once phonics are conceptually established.
  Demonstrated on 2 recall cards in the new test course (lessons 4–5).

## Added — Content flag button
- Small "⚑ Flag" button on every card. Tapping it shows a structured reason
  list (translation wrong, unnatural phrasing, culturally insensitive, audio
  mismatch, image mismatch, other + free text) rather than a vague "something's
  wrong" — matches the roadmap spec for making flags actually triageable later.
- Stored locally (IndexedDB `flags` store) and queued for the existing
  analytics pipeline (`/api/analytics/batch`), flushed opportunistically
  (immediately if online, retried on reconnect) — no new server endpoint
  needed, reuses what already exists.

## Added — Local streaks/badges
- Computed entirely from IndexedDB (`lessons` store), zero server requests.
  Shown on the course list screen: current day-streak (consecutive calendar
  days with a passed lesson) and a few milestone badges (first lesson,
  module complete, 7-day and 30-day streaks).

## Added — New test course: Spanish for English speakers
- `courses/spanish-for-english/course.schema-1.0.json` — 1 module, 5 lessons
  (needed since the mastery/review system had no way to be tested with only
  the existing 1-lesson Khmer course). English (native) → Spanish (learning),
  per your call on which language pair to build test content in.
- 34 total cards: 10 introduce, 10 recall (2 using `prompt_language:learning`),
  5 multiple_choice (properly domain-tagged), 8 phonics (4 sound pairs: ñ, ll,
  rr, j), 1 four-turn conversation. `audit_policy.every_n_lessons: 3` so the
  retention-audit path is actually reachable within this one module.
- **No images** — per your call, skipped rather than blocked on the
  not-yet-built image pipeline.
- **Audio does not exist yet** — 22 unique audio files are referenced
  (confirmed via a dry run of the manifest tool against this course, listed in
  full below) but none have been recorded/generated. This course will not
  play any sound until that's done. Path to get there, using tooling you
  already have:
  1. Push this release, then **import** `course.schema-1.0.json` through the
     admin panel (Admin → Import) — the audio manifest tool works off an
     imported course *version* in D1, not directly off the file in the repo,
     so this step is required first.
  2. Admin → Audio → download the manifest for that version.
  3. `python generate_audio.py manifest.json --output generated-audio --voice
     es-ES-...` (or whichever Spanish voice) via edge-tts in Termux, same as
     your existing workflow.
  4. **Before assuming any sound needs a human recording**, listen to the 4
     phonics "sound" files specifically (`*-PH00X-SOUND.mp3`) — this is
     exactly the test we discussed earlier to check whether TTS can handle an
     isolated phoneme convincingly before defaulting to recording it yourself.
  5. Admin → Audio → upload the generated files.
- **Spanish content should be reviewed by you before relying on it** — I
  can produce structurally correct, reasonable Spanish, but you have real
  learner experience I don't have an equivalent way to verify against.

## Audio manifest tooling (`worker-admin/src/index.js`)
- `collectAudioRefs()` updated to capture phonics' second audio field
  (`example_audio`) — previously only the generic `model_audio` field was
  swept automatically. Added a standing comment directly in the function
  (and a corresponding note in the roadmap) so this doesn't get missed again
  the next time a new card type is introduced.

## Known simplifications, stated plainly
- Audit-review is skipped on the same lesson that also triggers a module
  review, to avoid stacking two review types in one flow. Not spec'd either
  way; a reasonable default, not a hidden gap.
- `prompt_language:'learning'` cards use an English-only instruction line
  (no authored Khmer/native-language pairing for that specific variant) —
  a content gap, not a code gap.

No database migration required. Changed: `student/index.html`,
`student/sw.js` unaffected, `worker-admin/src/index.js`,
`courses/spanish-for-english/course.schema-1.0.json` (new).
