-- +goose Up
-- +goose StatementBegin
CREATE TABLE contest_participants (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    pet_name TEXT NOT NULL,
    pet_description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_participants_contest_id ON contest_participants (contest_id);
CREATE INDEX idx_participants_user_id ON contest_participants (user_id);
CREATE UNIQUE INDEX uniq_participants_contest_user ON contest_participants (contest_id, user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS uniq_participants_contest_user;
DROP INDEX IF EXISTS idx_participants_user_id;
DROP INDEX IF EXISTS idx_participants_contest_id;
DROP TABLE IF EXISTS contest_participants;
-- +goose StatementEnd
