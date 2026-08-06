CREATE TABLE IF NOT EXISTS courses (
  course_id TEXT PRIMARY KEY,title_en TEXT NOT NULL,title_kh TEXT,current_version_id TEXT,published INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS course_versions (
  version_id TEXT PRIMARY KEY,course_id TEXT NOT NULL,version_label TEXT,status TEXT NOT NULL DEFAULT 'draft',r2_object_key TEXT,content_sha256 TEXT,byte_size INTEGER,created_at TEXT NOT NULL,published_at TEXT,FOREIGN KEY(course_id) REFERENCES courses(course_id)
);
CREATE INDEX IF NOT EXISTS idx_course_versions_course ON course_versions(course_id,created_at);
CREATE INDEX IF NOT EXISTS idx_course_versions_status ON course_versions(status);
CREATE TABLE IF NOT EXISTS analytics_events (
  event_id TEXT PRIMARY KEY,installation_id TEXT NOT NULL,event_type TEXT NOT NULL,course_id TEXT,lesson_id TEXT,card_index INTEGER,payload_json TEXT NOT NULL,created_at TEXT NOT NULL,app_version TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_installation ON analytics_events(installation_id);
CREATE TABLE IF NOT EXISTS review_runs (
  review_id TEXT PRIMARY KEY,version_id TEXT NOT NULL,provider TEXT NOT NULL,model TEXT NOT NULL,focus TEXT,result_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audio_assets (
  asset_id TEXT PRIMARY KEY,version_id TEXT NOT NULL,item_id TEXT NOT NULL,source_type TEXT NOT NULL,object_key TEXT NOT NULL,approved INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS images (
  image_id TEXT PRIMARY KEY,
  concept_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  width INTEGER,
  height INTEGER,
  format TEXT DEFAULT 'webp',
  file_size INTEGER,
  sha256 TEXT,
  people_count INTEGER DEFAULT 0,
  contains_text INTEGER DEFAULT 0,
  culturally_specific INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_images_concept ON images(concept_id);
CREATE INDEX IF NOT EXISTS idx_images_sha256 ON images(sha256);
CREATE TABLE IF NOT EXISTS image_tags (
  image_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY(image_id,tag),
  FOREIGN KEY(image_id) REFERENCES images(image_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag);
CREATE TABLE IF NOT EXISTS course_card_images (
  course_id TEXT NOT NULL,
  course_version TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  PRIMARY KEY(course_id,course_version,activity_id),
  FOREIGN KEY(image_id) REFERENCES images(image_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_course_card_images_image ON course_card_images(image_id);
