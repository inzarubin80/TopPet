-- +goose Up
ALTER TABLE contests
    ADD COLUMN IF NOT EXISTS public_voting_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE contest_jury_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    scale_min INT NOT NULL DEFAULT 1,
    scale_max INT NOT NULL DEFAULT 10,
    scale_step INT NOT NULL DEFAULT 1,
    label_low TEXT NOT NULL DEFAULT '',
    label_high TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contest_jury_criteria_scale_check CHECK (
        scale_min < scale_max
        AND scale_step >= 1
    )
);

CREATE INDEX idx_contest_jury_criteria_contest_id ON contest_jury_criteria (contest_id);

-- +goose Down
DROP INDEX IF EXISTS idx_contest_jury_criteria_contest_id;
DROP TABLE IF EXISTS contest_jury_criteria;
ALTER TABLE contests DROP COLUMN IF EXISTS public_voting_enabled;
