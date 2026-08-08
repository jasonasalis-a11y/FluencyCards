# Fluency Engine — Roadmap (DRAFT, for discussion)

Everything below has been raised somewhere in our conversation. Grouped into five
milestones, sequenced so each one only depends on what came before it. Version numbers
are placeholders — adjust to whatever you're actually on when we start each phase.

---

## v0.9.7 — Learning Core (no new infra, no money changes hands)

The highest-value, lowest-risk work: it only touches the PWA and course schema, no
new database, no payments, no accounts.

- **Mastery & review system.** IndexedDB `cards`/`lessons` stores, the dual-axis
  recall rating (confidence × pronunciation) you showed me, lesson-pass tracking,
  and the 35%-floor module review algorithm.
- **Phonics card type.** `introduce` + `recall` variants, course-schema addition for
  a `phonics` activity type, and the `prompt_language` field so recall cards can
  switch from native → learning-language prompts once phonics are mastered.
  **Standing rule, not just for this release:** any future card type that carries
  its own audio field(s) needs `collectAudioRefs()` in `worker-admin/src/index.js`
  updated to capture them — the manifest tool doesn't discover new fields on its
  own. Phonics needed this for its second field (`example_audio`, alongside the
  generically-handled `model_audio`); see the comment left directly in that
  function as of the v0.9.7 phonics build.
- **Content-flag button, with structured reasons, not a freeform "something's
  wrong."** Tapping it shows a short pick-list — translation is wrong, language
  isn't natural/isn't how a native speaker would actually say it, culturally
  insensitive or inappropriate, audio doesn't match the text, image doesn't match
  the phrase — plus an "other" catch-all with a short text field. Structured reasons
  are what make this actually triageable at scale later: a reviewer can filter
  "cultural insensitivity" flags for language X separately from "translation
  quality" flags, rather than reading free text one at a time. Batched into the
  existing analytics-event pipeline — costs nothing extra in HTTP requests.
- **Local streaks/badges.** Computed entirely from IndexedDB, zero server requests,
  pure retention upside.

## v0.9.8 — Identity & Monetization Foundation

The minimum plumbing needed before *either* language-pack sales or tutoring can
exist — building it once, shared by both.

- **Course-key identity model — every course, free or paid, has a key.** Not a
  license in the traditional sense; more like an enrollment record. For a paid
  course, purchasing generates a short human-typeable code shown to the buyer, with
  a "Show My Course Key" one-tap re-display for entering it on another device. For a
  free course, the same kind of record is created automatically on first download —
  silent, no prompt, no code shown, zero added friction for someone whose real
  barrier is just reaching a device with a browser. The point isn't gating free
  content; it's giving every enrollment, paid or not, one consistent tracking
  anchor instead of two different mechanisms.
- **Whole-course pricing, not a module trial.** The free-first-module idea is
  dropped — after weighing it, the module trial still paywalls exactly the courses
  where you don't want a wall at all (e.g. Haitian Creole → English). Instead: each
  course has a `price_cents` set by you, per course, based on who it's actually
  serving — `0` for a course whose purpose is lifting people out of poverty, a real
  price for a course serving a better-resourced audience (e.g. English → Haitian
  Creole, priced higher, effectively cross-subsidizing the free direction). This is
  simpler to build than the trial *and* better serves the mission — worth stating
  outright that the earlier module-trial design is superseded, not layered on top.
- **Device cap only matters where there's something to cap.** Paid courses default
  to 3 *active* devices per key, self-service (redeeming on a 4th shows the current
  3, lets the person free a slot). Free courses have no meaningful cap — nothing is
  being metered, so `max_devices` is simply unlimited (`NULL`) for them. The 3-device
  sync is genuinely the thing being sold for paid courses, not a copy-protection
  measure — see the circumvention discussion for why that framing matters and what
  enforcement can and can't actually stop.
- **Students may never need a real account, even for tutoring.** A course key
  already uniquely represents "this person's enrollment in this course" — that's
  enough to anchor a tutor connection, progress sync, and reviews without ever
  requiring email/password signup on the student side. Only tutors need real
  accounts (`users` table), since they require payment and credential verification
  that a course key can't provide. This removes an entire assumption from the
  earlier tutoring design (that students needed `users` rows) — see the updated
  schema addendum.
- **No promised future updates — updates are made freely available if/when they
  exist, never guaranteed.** Whatever version you downloaded is yours to keep and use
  indefinitely; if a language is ever dropped from the catalog, existing installs
  keep working, they just stop receiving anything new. This is a real, meaningful
  difference from "updates for life" and should be worded that way anywhere it's
  customer-facing (store listing, FAQ, purchase confirmation) — "yours forever, as-is
  unless we choose to update it" rather than any kind of update commitment.
- **Stripe one-time-checkout integration** (paid courses only) + `course_keys` /
  `course_key_devices` tables (see schema addendum).
- **Admin panel: course-key lookup, device-slot reset, manual refund tool, and
  per-course price editor.**

## v0.9.9 — Course Creation Pipeline & Languages Database

The 36,000-phrase content pipeline. Biggest scope item, but nothing in it is
user-facing yet, so it can run in parallel with real usage of what's already live.

- New `fluencyengine-languages` D1 database (phrase bank, translations, phonics
  inventory, job tracking — per the schema/ERDs already delivered).
- Master English phrase catalog: AI-drafted, human-reviewed by you (per your plan —
  not automated).
- Translation pipeline: 3-tier LLM flow (best translator → best back-translator →
  cheapest frontier confidence-scorer), batch APIs, run via GitHub Actions.
- Image generation at 256×256 with concept-based reuse (~18k images, not 36k).
- Audio generation: hosted TTS API for phrases; Fiverr-sourced native speakers for
  phonics (decoupled from the tutor network, since that won't exist yet for a brand
  new language — this was the chicken-and-egg problem you flagged).
- Course-build tool assembling the final per-language `course.json`.

## v1.0 — Tutoring Marketplace

Now that identity (v0.9.8) and languages (v0.9.9) both exist, the marketplace has
something to plug into.

- Tutor signup, ID/credential upload, admin approval queue.
- Derived badges (credentialed teacher, course-completed, course-creator, review
  score) — computed, not stored, per the earlier schema design.
- Listings, connections (request/accept), $20 signup ($10 fee + 100 prepaid
  sessions), $10/100-session top-ups.
- Parallel-study sync: on-demand "sync my view to the student's card" button, not a
  background poll — matches your HTTP-request budget constraint.
- **Minor-safety policy — decide before launch, not after.** Your review-based
  trust model is reasonable adult-to-adult, but one-on-one connections handed off to
  WhatsApp/Zoom need an explicit stance on whether minors can use the tutoring side
  at all, and how that's enforced even loosely.
- Community reviewer role: native speakers helping triage flagged content from the
  v0.9.7 flag button — separate from paid tutors, could be volunteer or small
  Fiverr-style stipends.

## v1.1+ — Sustainability, Scale & Handoff Readiness

Once the core product and both revenue paths exist, this is what makes the project
durable long-term and fundable beyond individual language-pack sales.

- Institutional/NGO licensing pathway (resettlement orgs, literacy programs).
- Sponsor-a-learner (someone else funds a student's access/tutoring credits).
- **Paid completion certificates — the one legitimate case where a name/identity is
  actually required.** Issuing a certificate means knowing who to put on it and
  where to send it, which the anonymous course-key model deliberately doesn't
  capture. This doesn't reopen the "students need accounts" question, though — it's
  a one-time, checkout-style capture (name + email, taken at the moment of buying
  the certificate, same as Stripe already collects at checkout), not a persistent
  login. A `certificate_orders` row (`course_key`, `recipient_name`, `email`,
  `amount_cents`) is enough — no new identity system, no password, nothing that
  contradicts the no-forced-signup model everywhere else.
- Cloudflare usage dashboard in the admin panel (watch the free-tier trend before
  you cross it, not after) + basic rate limiting on public endpoints.
- **Security audit #1**, timed for right after this milestone — auditing the
  anonymous-only app before accounts/payments/tutoring existed would've missed most
  of what actually needs scrutiny.
- Open-source release prep: license selection for the app (vs. the separately
  licensed, paid course content), and a governance/handoff plan for an eventual
  foundation transfer — written *before* you hand it off, not during.
- **Security audit #2**, before or shortly after any large-scale public push.

---

## Explicit dependencies (why the order is what it is)

- Phonics cards (0.9.7) need the course-schema change that the pipeline (0.9.9) will
  also rely on — doing it first means the pipeline is built against the final
  schema, not a moving target.
- Course-key identity (0.9.8) has to exist before language-pack purchases *or*
  tutor connections — both need it, so it's built once, early, shared.
- Tutoring (1.0) depends on languages actually existing to tutor in (0.9.9) and on
  identity existing to register tutors against (0.9.8).
- The security audit is deliberately *after* accounts, payments, and tutoring exist
  — auditing before then would test a much smaller attack surface than the one
  that'll actually be live.

---

## Schema addendum: course keys & entitlements (fluencycards DB, v0.9.8)

```sql
-- One new column on the existing `courses` table — replaces the earlier
-- pricing_model/free_module_limit pair, which belonged to the module-trial
-- design that's since been dropped in favor of whole-course pricing.
ALTER TABLE courses ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0;
  -- 0 = free course. Any course can be priced individually — including $0 for
  -- ones you've decided the mission requires to be free, and a real price for
  -- others, e.g. to cross-subsidize a free direction with a paid one.

CREATE TABLE course_keys (
  course_key TEXT PRIMARY KEY,          -- short, human-typeable (e.g. 5x5 alphanumeric)
  course_id TEXT NOT NULL REFERENCES courses(course_id),
  amount_paid_cents INTEGER NOT NULL,   -- what was actually paid when issued (0 for free)
  payment_processor TEXT,               -- 'stripe'; null for free courses
  payment_reference TEXT,               -- null for free courses
  max_devices INTEGER,                  -- NULL = unlimited (typical for free courses); paid default 3
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'refunded' | 'revoked'
  issued_at TEXT NOT NULL
);

CREATE TABLE course_key_devices (
  course_key TEXT NOT NULL REFERENCES course_keys(course_key),
  device_id TEXT NOT NULL,              -- random UUID the PWA generates once, stores locally
  device_label TEXT,                    -- best-effort ("Chrome, Android") for the self-service list
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  removed_at TEXT,                      -- null = active slot; set when self-service-removed
  PRIMARY KEY (course_key, device_id)
);
```

`max_devices` lives on the row (not hardcoded) specifically so a future admin can
comp someone extra devices without a schema change, and so free courses can simply
carry `NULL` rather than needing separate logic. Slot counting = rows where
`removed_at IS NULL`; removing a device just sets `removed_at`, it doesn't delete the
row, so there's a full history if you ever need to investigate abuse.

**Tutoring tables updated accordingly:** `connections` and `tutor_reviews` (from the
original tutoring schema) now reference `course_key` on the student side instead of
a `users.user_id` — a course key already uniquely identifies "this person's
enrollment in this course," which is sufficient to anchor a connection, sync
progress, and attach a review, without requiring the student to ever create a real
account. `users` is now tutor-only, since tutors are the only side that actually
needs verified identity (payment + credentials). This is a genuine simplification
over the original design, not just a rename — one fewer thing (account creation)
standing between a student and getting help.

**One legitimate exception (v1.1+, not v0.9.8): completion certificates.**

```sql
CREATE TABLE certificate_orders (
  order_id TEXT PRIMARY KEY,
  course_key TEXT NOT NULL REFERENCES course_keys(course_key),
  recipient_name TEXT NOT NULL,   -- captured at checkout, not stored anywhere else
  email TEXT NOT NULL,            -- captured at checkout, for delivery only
  amount_cents INTEGER NOT NULL,
  payment_processor TEXT NOT NULL,
  payment_reference TEXT NOT NULL,
  issued_at TEXT NOT NULL
);
```

This is deliberately narrow — a one-time checkout capture tied to a single order, not
a reusable profile. It doesn't turn into an account, and it doesn't get reused for
anything else the next time that same course key does something in the app.

## On enforcement and circumvention (worth having a written answer to)

Your read is correct, and it's the correct read for *any* offline-capable,
open-source app, not a gap specific to this design: once a course package has been
downloaded and unzipped onto a device, nothing server-side can reach back in and
revoke it. The device cap controls how many times the *download endpoint* will hand
out the package for a given key — it has no power over a copy that already exists on
disk, and that's true no matter how the download was originally obtained.

Two things worth doing, neither of which changes that fundamental limit:

- **Enforce at the server, not the client** (already the plan above) — this means
  the cap applies identically regardless of what app is asking, including any
  alternative client someone builds against the open-source project later. A
  client-side check would be trivial to strip out of an open-source app; a
  server-side check isn't, because the client never had the authority to grant
  access in the first place.
- **Watermark, don't lock.** Embed the license key (or a hash of it) invisibly in
  the downloaded package — e.g. as metadata in `course.json` or a hidden field in
  the manifest. This does nothing to *prevent* redistribution, but if a copy turns
  up somewhere it shouldn't, it's traceable to the key that produced it. This is the
  same model DRM-free ebook and game stores (itch.io, Humble Bundle, most DRM-free
  ebook retailers) use, and it's a reasonable fit here for the same reason: it
  preserves trust and offline usability instead of fighting them.

The thing I'd actively avoid: any temptation toward client-side obfuscation or
encrypted course assets to "lock down" the local copy. For a $5 product aimed partly
at low-income users in underserved-language markets, that engineering cost buys very
little — the economics don't justify it, and it cuts against the openness that's core
to why you're open-sourcing this in the first place. Proportionate effort here is
server-side device capping + watermarking, and stopping there.
