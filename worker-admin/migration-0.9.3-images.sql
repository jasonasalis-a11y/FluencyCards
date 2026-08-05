CREATE TABLE IF NOT EXISTS image_assets (image_id TEXT PRIMARY KEY,concept_id TEXT NOT NULL,file_name TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,sha256 TEXT,size_bytes INTEGER,width INTEGER,height INTEGER,format TEXT,reuse_scope TEXT NOT NULL DEFAULT 'global',created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_image_assets_concept ON image_assets(concept_id);
CREATE TABLE IF NOT EXISTS course_image_links (version_id TEXT NOT NULL,item_id TEXT NOT NULL,image_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(version_id,item_id,image_id));
