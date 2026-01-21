-- +goose Up
-- +goose StatementBegin
CREATE TABLE contest_votes (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uniq_votes_contest_user ON contest_votes (contest_id, user_id);
CREATE INDEX idx_votes_contest_id ON contest_votes (contest_id);
CREATE INDEX idx_votes_participant_id ON contest_votes (participant_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_votes_participant_id;
DROP INDEX IF EXISTS idx_votes_contest_id;
DROP INDEX IF EXISTS uniq_votes_contest_user;
DROP TABLE IF EXISTS contest_votes;
-- +goose StatementEnd
