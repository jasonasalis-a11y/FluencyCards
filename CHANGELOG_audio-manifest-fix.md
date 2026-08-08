# Fluency Engine — Audio manifest fixes (spanish-for-english course.schema-1.0.json + worker-admin)

Two real bugs, both found through actually running the pipeline — exactly the kind
of thing this test course exists to catch before it happens to real content.

## Fixed
- **Phonics "sound" audio files were silently skipped by edge-tts, always.**
  `collectAudioRefs()`'s generic line synthesizes audio from
  `a.learning_text || a.expected?.text` — fields that don't exist on phonics
  activities at all (they use `grapheme`/`ipa` instead). Every phonics sound
  manifest entry had an empty `text` field from the moment it was generated,
  so `generate_audio.py` correctly skipped them (`if(!text)return skipped`) —
  it never got a chance to fail, it was just never asked. Fix: phonics now has
  its own branch in `collectAudioRefs()`, using the grapheme itself (e.g. "ñ")
  as the synthesis text for the sound file — the same approach most phonics
  apps use for isolated letter/digraph sounds. Confirmed via a dry run: all 4
  phonics sound entries now carry real text.
- **Lesson 1's ID was inconsistent with lessons 2–5** (`M01` instead of
  `M01L01`), a copy-paste artifact from reusing the single-lesson Khmer
  course's convention without updating it. Purely cosmetic — nothing broke —
  but worth fixing before this becomes a template for future courses. Lesson
  1 and everything under it (skill IDs, activity IDs, audio paths) renamed to
  `M01L01`.
- Course version bumped to `0.1.1-test` so the admin panel treats this as a
  distinct, re-importable version.

## What this means for your next steps
Because lesson 1's audio paths changed, its 3 real files (2 vocab + 1 example
word) need regenerating under the new path — they won't be picked up under
the old `M01/` folder name. All 4 phonics sound files across every lesson
need generating now that they actually have text. Everything else you already
generated (lessons 2-5's vocab/example/conversation audio) is untouched and
doesn't need to be redone.

1. Re-import this updated `course.schema-1.0.json` (new version).
2. Admin → Audio → download a fresh manifest for the new version.
3. Same command as before, against the new manifest:
   ```
   python generate_audio.py ~/storage/downloads/<new-manifest>.json --output ~/storage/downloads/generated-audio --voice es-ES-ElviraNeural
   ```
   `generate_audio.py` skips any file that already exists on disk, so this
   will only actually generate what's missing/renamed — the lesson 2-5 files
   you already have will just show as `existing` and be left alone.
4. Listen to the 4 phonics sound files specifically — this is the actual test
   we've been trying to run since before this bug was found.
5. Admin → Audio → upload the new/regenerated files.

No code changes to the PWA itself in this release — `worker-admin/src/index.js`
and `courses/spanish-for-english/course.schema-1.0.json` only.
