-- ============================================================
-- Migration: Paper Reports (Community Moderation)
-- Paste this into the Supabase SQL Editor and click "Run".
-- ============================================================

-- Add report_count column to existing papers table
ALTER TABLE papers ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;

-- Create the paper_reports table
CREATE TABLE IF NOT EXISTS paper_reports (
    id          SERIAL        PRIMARY KEY,
    paper_id    INTEGER       NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    reason      VARCHAR(500)  NOT NULL,
    device_id   VARCHAR(64),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Ensure device_id exists if paper_reports table was already created
ALTER TABLE paper_reports ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);

-- Index speeds up counting reports per paper
CREATE INDEX IF NOT EXISTS ix_paper_reports_paper_id
    ON paper_reports (paper_id);

-- Index speeds up duplicate checking per device per paper
CREATE INDEX IF NOT EXISTS ix_paper_reports_paper_device
    ON paper_reports (paper_id, device_id);



-- Add device_id to paper_reports table to prevent duplicate reports per device
ALTER TABLE paper_reports ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);

-- Create an index for fast duplicate checks
CREATE INDEX IF NOT EXISTS ix_paper_reports_paper_device
    ON paper_reports (paper_id, device_id);