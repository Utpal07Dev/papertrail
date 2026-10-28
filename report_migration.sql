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
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Index speeds up counting reports per paper
CREATE INDEX IF NOT EXISTS ix_paper_reports_paper_id
    ON paper_reports (paper_id);

