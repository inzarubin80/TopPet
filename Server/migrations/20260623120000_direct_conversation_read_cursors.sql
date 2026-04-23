-- +goose Up
ALTER TABLE direct_conversations
    ADD COLUMN last_read_at_user_low TIMESTAMPTZ,
    ADD COLUMN last_read_at_user_high TIMESTAMPTZ;

UPDATE direct_conversations
SET
    last_read_at_user_low = last_message_at,
    last_read_at_user_high = last_message_at
WHERE last_read_at_user_low IS NULL
   OR last_read_at_user_high IS NULL;

-- +goose Down
ALTER TABLE direct_conversations
    DROP COLUMN IF EXISTS last_read_at_user_low,
    DROP COLUMN IF EXISTS last_read_at_user_high;
