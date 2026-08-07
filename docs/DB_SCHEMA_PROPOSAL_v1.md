# Fluency Engine — Schema Proposal v1 (DRAFT, not yet applied)

This covers three separate storage layers, matching your instinct to split things:

1. **`fluencycards` (existing D1)** — runtime/operational data: courses, content assets,
   analytics, and the new tutoring marketplace. Stays fast because it never touches the
   36k-phrase translation pipeline.
2. **`fluencyengine-languages` (new D1)** — the master phrase bank, translations, phonics
   inventories, and generation job tracking for the course-creation pipeline. This is the
   one that'll eventually hold 100+ languages × 36,000 phrases.
3. **IndexedDB (client-side, in the PWA)** — per-device mastery/review state. This is
   *not* synced to a server by default. It only gets mirrored to D1 for a specific
   student once they accept a tutor connection (see §3.4) — otherwise nobody's learning
   history leaves their phone.

D1 does not support cross-database foreign keys or joins. Anywhere a table references
an ID that lives in the *other* database, it's a plain `TEXT` column with no `FOREIGN
KEY` — enforcement and joins happen in Worker code, not SQL. I've flagged every one of
these explicitly below so it isn't mistaken for an oversight.

---

## 1. `fluencycards` — additions to the existing database

### 1.1 Existing tables (unchanged)
`courses`, `course_versions`, `analytics_events`, `review_runs`, `audio_assets`,
`images`, `image_tags`, `course_card_images`, `image_generation_jobs`,
`image_generation_items` — kept as-is. `course_versions_legacy_093` is dead weight;
recommend dropping it once you confirm nothing still reads it.

**No schema change needed for the 512→256 image size switch.** `images.width` /
`images.height` already exist as columns — just point the generation tool at 256×256
as the new default. `course_card_images` already keys images by `(course_id,
course_version, activity_id)`, and `images.concept_id` already gives you the
cross-course/cross-language reuse pattern you want. This part of your existing design
already does what you need.

**`audio_assets` — recommend deprecating in favor of a phrase-keyed table in the
languages DB** (see §2.6). Right now it's keyed to `version_id` + `item_id`, which
means regenerating a course version orphans the audio linkage. Audio, like
translations, is really a property of `(phrase_number, language_code)` — it should be
generated once per language and referenced by convention (`audio/{lang}/{phrase_number}.mp3`)
across every course version, not re-tied per version. Migration: one-time script maps
existing `audio_assets` rows to `(phrase_number, language_code)` in the new table,
then the old table can be dropped.

### 1.2 New: users & auth (tutors only)
Nothing in the current system has real user accounts — analytics uses an anonymous
`installation_id`, and students' identity for tutoring/progress purposes comes from
their course key (see the roadmap's schema addendum), not an account. Tutors are the
one role that genuinely needs verified real-world identity, since they handle
payment and credential review. This is the foundation everything else in this
section depends on.

```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT,
  display_name TEXT NOT NULL,
  auth_provider TEXT NOT NULL,        -- 'password' | 'google' | 'apple' | ...
  auth_subject TEXT,                  -- external id if using an auth provider
  password_hash TEXT,                 -- null if using external provider
  role_flags INTEGER NOT NULL DEFAULT 0, -- bitmask: 2=tutor 4=course_creator 8=admin
                                          -- (no student bit — students use course_keys, not accounts)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' -- 'active' | 'suspended' | 'deleted'
);
```

> **`users` is tutor-only.** Students never need an account — a course key (see
> §1.4-equivalent in the roadmap's schema addendum) is sufficient identity for
> progress tracking, tutor connections, and reviews. Only tutors need verified
> real-world identity, since they're the side handling payment and credentials.

> **Open question:** what auth provider do you want (Cloudflare Access is
> admin-only today; you'll need something like Clerk, Auth0, or a homegrown
> email+password flow for tutors)? This affects `auth_provider`/`auth_subject`
> but not the rest of the schema.

### 1.3 New: tutoring marketplace

```sql
CREATE TABLE tutor_profiles (
  tutor_id TEXT PRIMARY KEY REFERENCES users(user_id),
  bio TEXT,
  price_per_session_cents INTEGER,     -- what the tutor charges the student (outside the app)
  preferred_contact_method TEXT,       -- 'whatsapp' | 'zoom' | 'other'
  preferred_contact_value TEXT,        -- phone number / link / handle
  id_document_r2_key TEXT NOT NULL,    -- private bucket, never public
  credential_r2_key TEXT,              -- teaching credential doc, if any
  course_completion_substitute INTEGER NOT NULL DEFAULT 0, -- 1 if using "completed the course" in lieu of credential
  application_status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'|'suspended'
  applied_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,                    -- admin user_id
  session_credit_balance INTEGER NOT NULL DEFAULT 0,
  is_course_creator INTEGER NOT NULL DEFAULT 0, -- badge source
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tutor_languages (
  tutor_id TEXT NOT NULL REFERENCES tutor_profiles(tutor_id),
  language_code TEXT NOT NULL,         -- cross-DB reference to languages DB, no FK
  credential_type TEXT NOT NULL,       -- 'credentialed_teacher' | 'course_completed' | 'native_speaker'
  course_completion_pct REAL,          -- populated if credential_type = 'course_completed'
  PRIMARY KEY (tutor_id, language_code)
);

CREATE TABLE tutor_reviews (
  review_id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL REFERENCES tutor_profiles(tutor_id),
  course_key TEXT NOT NULL,            -- identifies the student; see roadmap schema addendum
  connection_id TEXT NOT NULL,         -- see below; a review requires a completed connection
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL
);

-- Badges are DERIVED, not stored: credentialed_teacher / course_completed_100 /
-- course_creator / avg_rating all come from tutor_languages + tutor_profiles +
-- tutor_reviews at query time. Storing them separately risks drift. If listing-page
-- read latency ever becomes a problem, add a materialized `tutor_badge_cache` table
-- refreshed on write — not needed at launch.

CREATE TABLE tutor_credit_purchases (
  purchase_id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL REFERENCES tutor_profiles(tutor_id),
  sessions_purchased INTEGER NOT NULL DEFAULT 100,
  amount_cents INTEGER NOT NULL DEFAULT 1000,
  is_signup_bundle INTEGER NOT NULL DEFAULT 0, -- 1 for the initial $10-of-the-$20 signup bundle
  payment_processor TEXT NOT NULL,     -- 'stripe'
  payment_reference TEXT NOT NULL,     -- processor's charge/payment-intent id
  created_at TEXT NOT NULL
);

CREATE TABLE tutor_signup_payments (
  payment_id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL REFERENCES tutor_profiles(tutor_id),
  amount_cents INTEGER NOT NULL DEFAULT 2000, -- $10 signup + $10 prepaid sessions
  payment_processor TEXT NOT NULL,
  payment_reference TEXT NOT NULL,
  paid_at TEXT NOT NULL
);

CREATE TABLE connections (
  connection_id TEXT PRIMARY KEY,
  course_key TEXT NOT NULL,            -- identifies the student + which course; see roadmap schema addendum
  tutor_id TEXT NOT NULL REFERENCES tutor_profiles(tutor_id),
  course_id TEXT NOT NULL,             -- denormalized from course_key for easy querying; matches courses.course_id
  status TEXT NOT NULL DEFAULT 'requested', -- 'requested'|'accepted'|'declined'|'ended'
  requested_by_role TEXT NOT NULL,     -- 'student' | 'tutor' — who initiated
  requested_at TEXT NOT NULL,
  accepted_at TEXT,
  ended_at TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE TABLE tutor_session_usage (
  usage_id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL REFERENCES tutor_profiles(tutor_id),
  connection_id TEXT NOT NULL REFERENCES connections(connection_id),
  session_cost_cents INTEGER NOT NULL DEFAULT 10,
  used_at TEXT NOT NULL
);
```

**Parallel-study sync** (tutor sees exactly what card the student is on, and their
review queue) requires *some* student progress to leave the device once a connection
is `accepted`. This is the one place client (IndexedDB) and server (D1) state touch:

```sql
CREATE TABLE student_progress_sync (
  connection_id TEXT NOT NULL REFERENCES connections(connection_id),
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  current_activity_id TEXT NOT NULL,
  current_activity_type TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (connection_id)
);

CREATE TABLE student_review_queue_sync (
  connection_id TEXT NOT NULL REFERENCES connections(connection_id),
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  reason TEXT NOT NULL,               -- 'wrong_answer' | 'low_rating'
  added_at TEXT NOT NULL,
  cleared_at TEXT,
  PRIMARY KEY (connection_id, item_id)
);
```

> **Privacy note:** these two tables should only ever contain rows for `accepted`
> connections, and should be purged (or at minimum stop updating) when a connection is
> `ended`. Worth stating explicitly in your privacy policy given ID documents and
> learning data are both sensitive.

### 1.4 New: phonics support
No new tables needed in this database — a phonics card is just another `activity`
type in the course JSON (see §4). The *inventory* of phonemes per language and how
they're sequenced into lessons belongs in the languages DB (§2.7), since it's
generated once during course building, same as translations.

---

## 2. `fluencyengine-languages` — new database

```sql
CREATE TABLE languages (
  language_code TEXT PRIMARY KEY,      -- 'en', 'kh', 'es', ...
  english_name TEXT NOT NULL,
  native_name TEXT,
  script TEXT,
  rtl INTEGER NOT NULL DEFAULT 0,
  tts_provider TEXT,
  tts_voice_id TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- 'planned'|'translating'|'phonics_pending'|'building'|'published'
  created_at TEXT NOT NULL
);

CREATE TABLE phrase_bank (
  phrase_number INTEGER PRIMARY KEY,   -- 1..36000; language-agnostic identifier
  english_text TEXT NOT NULL,
  module_number INTEGER NOT NULL,      -- 1..400
  lesson_number INTEGER NOT NULL,      -- 1..5 within the module
  position_in_lesson INTEGER NOT NULL, -- 1..18
  complexity_tier INTEGER,             -- phonics-complexity ranking, lower = simpler
  is_survival_phrase INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE translations (
  translation_id TEXT PRIMARY KEY,
  phrase_number INTEGER NOT NULL REFERENCES phrase_bank(phrase_number),
  language_code TEXT NOT NULL REFERENCES languages(language_code),
  translated_text TEXT NOT NULL,
  back_translation_text TEXT,
  confidence_score REAL,               -- 0.00–1.00, threshold 0.94 per your spec
  translation_model TEXT NOT NULL,
  back_translation_model TEXT,
  confidence_model TEXT,
  alternate_translation TEXT,          -- populated when confidence < 0.94
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'ai_approved'|'flagged'|'human_reviewed'|'approved'|'rejected'
  reviewed_by TEXT,                    -- admin user — cross-DB reference to fluencycards.users, no FK
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (phrase_number, language_code)
);

CREATE TABLE phonics_inventory (
  phoneme_id TEXT PRIMARY KEY,
  language_code TEXT NOT NULL REFERENCES languages(language_code),
  grapheme TEXT NOT NULL,
  ipa TEXT,
  category TEXT NOT NULL,              -- 'consonant'|'vowel'|'blend'|'digraph'
  frequency_rank INTEGER,              -- teaching order within category
  example_word TEXT,
  example_audio_r2_key TEXT,
  mastery_target_module INTEGER        -- module by which this phoneme should be introduced
);

CREATE TABLE phonics_card_assignments (
  assignment_id TEXT PRIMARY KEY,
  language_code TEXT NOT NULL REFERENCES languages(language_code),
  phoneme_id TEXT NOT NULL REFERENCES phonics_inventory(phoneme_id),
  module_number INTEGER NOT NULL,
  lesson_number INTEGER NOT NULL,
  card_variant TEXT NOT NULL           -- 'introduce' | 'recall'
);

CREATE TABLE audio_assets (
  asset_id TEXT PRIMARY KEY,
  phrase_number INTEGER REFERENCES phrase_bank(phrase_number), -- null for phonics-only audio
  phoneme_id TEXT REFERENCES phonics_inventory(phoneme_id),    -- null for phrase audio
  language_code TEXT NOT NULL REFERENCES languages(language_code),
  source_type TEXT NOT NULL,           -- 'edge_tts' | 'other_tts' | 'human'
  provider TEXT,
  voice_id TEXT,
  object_key TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE translation_jobs (
  job_id TEXT PRIMARY KEY,
  language_code TEXT NOT NULL REFERENCES languages(language_code),
  translation_model TEXT NOT NULL,
  back_translation_model TEXT NOT NULL,
  confidence_model TEXT NOT NULL,
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE audio_generation_jobs (
  job_id TEXT PRIMARY KEY,
  language_code TEXT NOT NULL REFERENCES languages(language_code),
  provider TEXT NOT NULL,
  total_items INTEGER NOT NULL,
  completed_items INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE audio_generation_items (
  job_id TEXT NOT NULL REFERENCES audio_generation_jobs(job_id),
  phrase_number INTEGER,
  phoneme_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  PRIMARY KEY (job_id, COALESCE(phrase_number, 0), COALESCE(phoneme_id, ''))
);

CREATE TABLE course_build_jobs (
  job_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,             -- cross-DB reference to fluencycards.courses, no FK
  language_code TEXT NOT NULL REFERENCES languages(language_code),
  status TEXT NOT NULL DEFAULT 'pending',
  output_r2_key TEXT,                  -- lands in the SAME r2 bucket course_versions already uses
  created_at TEXT NOT NULL,
  completed_at TEXT
);
```

**On TTS at 36,000-phrase scale:** running edge-tts on-device in Termux for 36k
phrases × N languages is not practical — you're right to want alternatives. Worth
evaluating (not decided here): Azure/Microsoft's hosted TTS API (same voices edge-tts
uses, but as a paid, rate-limit-friendly API instead of the free unofficial endpoint),
Google Cloud TTS, or ElevenLabs for higher quality at higher cost. Whichever you pick,
`audio_generation_jobs`/`items` above works the same way — it's provider-agnostic, so
this is a decision you can make later without touching the schema.

---

## 3. IndexedDB — client-side (PWA), per-device, not synced by default

Object stores (not SQL — IndexedDB is a key/value + index store):

```
cards
  keyPath: [courseId, itemId]
  fields: courseId, lessonId, moduleId, itemId, itemType,
          recallRating,       -- recall cards only: 'didnt_know'|'hesitated'|'knew_it'
          pronunciationRating,-- recall cards only: 'not_so_good'|'okay'|'good'|'great'
          mcResult,           -- multiple_choice only: 'correct'|'incorrect'
          -- null for introduce/conversation (never scored)
          timesSeen, timesFailed, lastSeenAt, masteredAt (nullable)
  indexes: by [courseId, lessonId], by [courseId, moduleId]

lessons
  keyPath: [courseId, lessonId]
  fields: courseId, moduleId, passed (bool), passedAt, attempts

moduleReviewSessions            -- log of generated review sets, for debugging/analytics
  keyPath: [courseId, moduleId, generatedAt]
  fields: cardIds[], failedCardIds[], targetPct, actualPct
```

**Pass/fail rule for recall cards:** a card counts as passed only if
`recallRating ∈ {hesitated, knew_it}` **AND** `pronunciationRating ∈ {good, great}`.
Failing on either axis alone (e.g. "I knew it" + "Okay" pronunciation) queues the card
for review, same as "I didn't know it" would. Multiple-choice cards pass on
`mcResult === 'correct'`.

**Review-set selection logic** (matches your spec): for a module review, let `F` =
fraction of the module's scored cards (recall + multiple_choice; introduce and
conversation excluded) that were *not* passed. Target review size =
`max(0.35, F) × totalScoredCards`, always including 100% of failed cards first, then
filling the remainder with a pseudo-random sample of passed cards (seeded so repeats
are spread evenly across modules rather than always drawing from the same early
cards — worth a weighting scheme, e.g. weighted toward cards not seen in review
recently). End-of-lesson review is simpler: 100% of that lesson's not-yet-passed
cards, no random fill.

---

## 4. Course JSON schema note (not a database change)

Two follow-ups this design implies for `docs/fluencycards-course-schema-1.0.0.json`,
flagged for when we get to that phase — not acted on yet:

- A `phonics` activity type, with `variant: 'introduce'|'recall'`.
- Once all phonics are mastered, `recall` cards switch their prompt language from
  native → learning language. Likely needs a `prompt_language` field on `recall`
  activities (default `'native'`, settable to `'learning'`) rather than a whole new
  activity type.

---

## 5. Operations matrix — who reads/writes what

| Table | Created by | Read by | Updated by | Deleted by |
|---|---|---|---|---|
| `users` | Signup flow (student or tutor) | Auth middleware, admin panel | Profile edits, admin suspension | Account deletion (GDPR) |
| `tutor_profiles` | Tutor signup form | Tutor listing (public worker), admin review queue | Admin approval/rejection, tutor self-edit | Admin (soft delete via status) |
| `tutor_languages` | Tutor signup form | Tutor listing/search | Tutor self-edit | Tutor self-edit |
| `tutor_reviews` | Student, after a connection ends | Tutor listing (avg rating) | — (immutable) | Admin moderation only |
| `tutor_credit_purchases` | Stripe webhook on purchase | Balance calc, admin | — | — |
| `tutor_signup_payments` | Stripe webhook on tutor signup | Admin, finance export | — | — |
| `connections` | Student "connect" request | Both parties' PWAs, admin | Accept/decline/end actions | — |
| `tutor_session_usage` | Worker, on each shared session | Balance calc, admin | — | — |
| `student_progress_sync` | PWA heartbeat (connected students only) | Tutor's PWA | PWA heartbeat | On connection end |
| `student_review_queue_sync` | PWA, on wrong answer/low rating | Tutor's PWA | Cleared when card is re-passed | On connection end |
| `courses`, `course_versions` | Admin panel (existing) | Public worker, admin | Admin panel | Admin panel |
| `images`, `image_tags`, `course_card_images` | Image generation tool | Course build tool, admin | Admin review | Admin |
| `languages` | Admin (new course-creation tab) | Everything in languages DB | Admin | — |
| `phrase_bank` | AI phrase-generation tool (one-time, English only) | Translation tool, course build tool | Admin edits | — |
| `translations` | Translation pipeline (3-model flow) | Course build tool, admin review queue | Human reviewer, re-run pipeline | — |
| `phonics_inventory`, `phonics_card_assignments` | Phonics-analysis tool (per language) | Course build tool | Admin edits | — |
| `audio_assets` (languages DB) | Audio generation pipeline | Course build tool | Admin re-approval | — |
| `translation_jobs`, `audio_generation_jobs/items`, `course_build_jobs` | Respective admin-panel tools | Admin job-status views | Worker updates status as it runs | Admin cleanup of old jobs |

---

## 6. Migration notes (once schema is agreed)

1. Create `fluencyengine-languages` as a new D1 database + binding in
   `worker-admin/wrangler.toml`.
2. Add the tutoring tables to `fluencycards` via a new migration `.sql` file, following
   your existing convention (there isn't a numbered migrations folder yet visible in
   the repo — recommend starting one now, e.g. `migrations/0001_tutoring.sql`, rather
   than continuing to evolve `courses`/`course_versions` schemas ad hoc).
3. `course_versions_legacy_093` — confirm nothing reads it, then drop.
4. `audio_assets` in `fluencycards` — one-time backfill script into the new
   phrase-keyed table in `fluencyengine-languages`, then drop the old one.
