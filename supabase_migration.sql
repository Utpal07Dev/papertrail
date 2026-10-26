-- ============================================================
-- Supabase Migration: Course Resources
-- Paste this into the Supabase SQL Editor and click "Run".
-- ============================================================

CREATE TABLE IF NOT EXISTS course_resources (
    id          SERIAL        PRIMARY KEY,
    course_code VARCHAR(50)   NOT NULL,
    description VARCHAR(500)  NOT NULL,
    url         VARCHAR(1000),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Index speeds up the GET /api/courses/{course_code}/resources lookup.
CREATE INDEX IF NOT EXISTS ix_course_resources_course_code
    ON course_resources (course_code);
