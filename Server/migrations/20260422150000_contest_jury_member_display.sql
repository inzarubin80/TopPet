-- +goose Up
ALTER TABLE contest_jury_members
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio_short TEXT NOT NULL DEFAULT '';

-- Порядок по дате добавления для уже существующих записей
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY contest_id ORDER BY created_at ASC) - 1 AS rn
  FROM contest_jury_members
)
UPDATE contest_jury_members j
SET sort_order = ranked.rn
FROM ranked
WHERE j.id = ranked.id;

-- +goose Down
ALTER TABLE contest_jury_members DROP COLUMN IF EXISTS sort_order;
ALTER TABLE contest_jury_members DROP COLUMN IF EXISTS portfolio_url;
ALTER TABLE contest_jury_members DROP COLUMN IF EXISTS bio_short;
