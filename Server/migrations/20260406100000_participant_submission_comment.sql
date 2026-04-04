-- +goose Up
ALTER TABLE contest_participants
    ADD COLUMN IF NOT EXISTS submission_comment TEXT NULL;

-- +goose Down
ALTER TABLE contest_participants
    DROP COLUMN IF EXISTS submission_comment;
