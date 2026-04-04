-- +goose Up
ALTER TABLE contest_participants
    ADD COLUMN IF NOT EXISTS owner_last_read_staff_comment_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN contest_participants.owner_last_read_staff_comment_at IS
    'Когда владелец заявки последний раз открывал комментарии (пометка прочитанных ответов организатора).';

-- +goose Down
ALTER TABLE contest_participants
    DROP COLUMN IF EXISTS owner_last_read_staff_comment_at;
