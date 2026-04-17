-- +goose Up
-- +goose StatementBegin
DROP INDEX IF EXISTS uniq_votes_contest_user_nom_slot;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_votes_contest_user_participant ON contest_votes (contest_id, user_id, participant_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS uniq_votes_contest_user_participant;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_votes_contest_user_nom_slot ON contest_votes (contest_id, user_id, nomination_slot);
-- +goose StatementEnd
