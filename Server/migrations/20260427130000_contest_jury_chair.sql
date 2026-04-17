-- +goose Up
ALTER TABLE contest_jury_members
  ADD COLUMN IF NOT EXISTS is_chair BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_jury_chair_per_contest
  ON contest_jury_members (contest_id)
  WHERE is_chair = TRUE;

-- +goose Down
DROP INDEX IF EXISTS uniq_jury_chair_per_contest;
ALTER TABLE contest_jury_members DROP COLUMN IF EXISTS is_chair;
