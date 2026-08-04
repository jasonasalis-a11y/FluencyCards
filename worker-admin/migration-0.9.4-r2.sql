PRAGMA foreign_keys=OFF;

ALTER TABLE course_versions RENAME TO course_versions_legacy_093;

CREATE TABLE course_versions (
  version_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  version_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  r2_object_key TEXT,
  content_sha256 TEXT,
  byte_size INTEGER,
  created_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY(course_id) REFERENCES courses(course_id)
);

INSERT INTO course_versions
(version_id,course_id,version_label,status,r2_object_key,content_sha256,byte_size,created_at,published_at)
SELECT version_id,course_id,version_label,'legacy-needs-reimport',NULL,NULL,LENGTH(course_json),created_at,published_at
FROM course_versions_legacy_093;

CREATE INDEX IF NOT EXISTS idx_course_versions_course ON course_versions(course_id,created_at);
CREATE INDEX IF NOT EXISTS idx_course_versions_status ON course_versions(status);

PRAGMA foreign_keys=ON;
