-- +goose Up
-- +goose StatementBegin
-- Remove unique constraint that limits one participant per user per contest
-- Users can now add unlimited participants to a contest
DROP INDEX IF EXISTS uniq_participants_contest_user;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Restore unique constraint (if needed for rollback)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_participants_contest_user ON contest_participants (contest_id, user_id);
-- +goose StatementEnd
