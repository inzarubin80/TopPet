-- +goose Up
-- +goose StatementBegin
CREATE TABLE contest_comments (
    id UUID PRIMARY KEY,
    participant_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_participant_id_created_at ON contest_comments (participant_id, created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_comments_participant_id_created_at;
DROP TABLE IF EXISTS contest_comments;
-- +goose StatementEnd
