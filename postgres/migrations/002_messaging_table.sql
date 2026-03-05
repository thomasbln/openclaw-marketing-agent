-- Messaging table for /wording 7d Block 4 (language contrast)
-- Run: psql -U radar_user -d legal_intel < migrations/002_messaging_table.sql

CREATE TABLE IF NOT EXISTS messaging (
  page_id     TEXT PRIMARY KEY,
  headline    TEXT,
  subheadline TEXT,
  pain_block  TEXT,
  cta         TEXT,
  version     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON messaging TO radar_user;
