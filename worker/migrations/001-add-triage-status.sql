-- Adds triage state to a `reports` table created before it existed.
-- SQLite has no ADD COLUMN IF NOT EXISTS, so running this twice fails with
-- "duplicate column name" — that error means it has already been applied.
ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE reports ADD COLUMN resolution TEXT;
ALTER TABLE reports ADD COLUMN resolved_at TEXT;
CREATE INDEX IF NOT EXISTS reports_status ON reports (status);
