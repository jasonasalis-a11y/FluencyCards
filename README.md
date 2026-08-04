# FluencyCards v0.9.3 — Mastery Schema Foundation

Added:
- Course Schema 1.0
- GO/NO-GO mastery
- app-generated targeted retraining
- retention audits every configurable number of lessons
- instructor consent/data model; instructor assists rather than assigns retraining
- instructional analytics specification
- existing Module 1 converted to a Schema 1.0 draft
- responsive no-scroll ordinary-card layout
- D1 migration for mastery, audits, retraining, and instructor links

Limitations:
- Automatic pronunciation scoring is not yet implemented.
- Live remote instructor synchronization is modeled but not yet implemented.
- R2 publishing is the next backend step.
- Run `worker-admin/migration-0.9.3.sql` in the D1 console before using server-side mastery records.
