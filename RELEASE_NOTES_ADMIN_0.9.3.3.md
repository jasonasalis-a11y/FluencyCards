# Fluency Engine Admin 0.9.3.3 Stabilization

- Corrects the image ZIP upload Worker to use the existing canonical D1 tables `images` and `course_card_images`.
- Maps Worker writes to the existing columns `r2_key`, `file_size`, `course_id`, `course_version`, `lesson_id`, and `activity_id`.
- Removes the obsolete migration that attempted to introduce parallel `image_assets` and `course_image_links` tables.
- Preserves the working whole-course ZIP image extraction, filtering, filename matching, 512×512 WebP normalization, and R2 upload workflow.
- Adds a permanent repository release gate and schema-contract validator.
- The release gate checks Admin Worker SQL against the canonical D1 schema and also checks the Public Worker automatically whenever it is present in the repository.
- No D1 migration is required.
