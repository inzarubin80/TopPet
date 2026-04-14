-- +goose Up
ALTER TABLE contests
    ADD COLUMN IF NOT EXISTS entry_title_hint TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE contests
    DROP COLUMN IF EXISTS entry_title_hint;
