-- Feedback reports. One row per submission; the screenshot, when there is one,
-- lives in R2 under the key in screenshot_key.
CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  app_version   TEXT,
  surface       TEXT,
  unit_id       TEXT,
  lesson_id     TEXT,
  activity_id   TEXT,
  category      TEXT,
  note          TEXT NOT NULL DEFAULT '',
  -- The rendered report, exactly as the reporter reviewed it before sending.
  markdown      TEXT NOT NULL DEFAULT '',
  -- The structured envelope, for querying across reports later.
  payload_json  TEXT NOT NULL,
  -- Null is the ordinary case for a report sent without a picture.
  screenshot_key TEXT,
  -- Triage state. Separate from the sync watermark: "pulled to a laptop" and
  -- "dealt with" are different facts, and only this one is worth keeping.
  status        TEXT NOT NULL DEFAULT 'new',
  resolution    TEXT,
  resolved_at   TEXT
);

-- The sync script pages through by timestamp.
CREATE INDEX IF NOT EXISTS reports_created_at ON reports (created_at);
CREATE INDEX IF NOT EXISTS reports_activity ON reports (activity_id);
CREATE INDEX IF NOT EXISTS reports_status ON reports (status);
