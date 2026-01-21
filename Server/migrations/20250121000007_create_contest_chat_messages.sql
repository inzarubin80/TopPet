-- +goose Up
-- +goose StatementBegin
CREATE TABLE contest_chat_messages (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    text TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_contest_id_created_at ON contest_chat_messages (contest_id, created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_chat_contest_id_created_at;
DROP TABLE IF EXISTS contest_chat_messages;
-- +goose StatementEnd
