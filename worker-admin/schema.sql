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
