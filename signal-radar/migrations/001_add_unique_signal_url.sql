-- Unique constraint on signals.url (required for ON CONFLICT in db.js)
-- Run: psql -U postgres -d <your_db> -f 001_add_unique_signal_url.sql

ALTER TABLE signals ADD CONSTRAINT unique_signal_url UNIQUE (url);
