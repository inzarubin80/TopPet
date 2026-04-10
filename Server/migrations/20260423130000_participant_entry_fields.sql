-- +goose Up
-- +goose StatementBegin
ALTER TABLE contest_participants
    ADD COLUMN IF NOT EXISTS entry_title TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS entry_description TEXT NOT NULL DEFAULT '';

UPDATE contest_participants
SET
    entry_title = CASE WHEN btrim(entry_title) = '' THEN pet_name ELSE entry_title END,
    entry_description = CASE WHEN btrim(entry_description) = '' THEN pet_description ELSE entry_description END;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contest_participants
    DROP COLUMN IF EXISTS entry_title,
    DROP COLUMN IF EXISTS entry_description;
-- +goose StatementEnd
