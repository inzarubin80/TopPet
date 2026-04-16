-- +goose Up
-- +goose StatementBegin
ALTER TABLE contest_comments
    ADD COLUMN parent_id UUID NULL REFERENCES contest_comments (id) ON DELETE SET NULL;

ALTER TABLE contest_chat_messages
    ADD COLUMN parent_id UUID NULL REFERENCES contest_chat_messages (id) ON DELETE SET NULL;

CREATE INDEX idx_comments_parent_id ON contest_comments (parent_id);
CREATE INDEX idx_chat_parent_id ON contest_chat_messages (parent_id);

CREATE TABLE contest_comment_votes (
    comment_id UUID NOT NULL REFERENCES contest_comments (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX idx_comment_votes_comment_id ON contest_comment_votes (comment_id);

CREATE TABLE contest_chat_message_votes (
    message_id UUID NOT NULL REFERENCES contest_chat_messages (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_chat_message_votes_message_id ON contest_chat_message_votes (message_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS contest_chat_message_votes;
DROP TABLE IF EXISTS contest_comment_votes;
DROP INDEX IF EXISTS idx_chat_parent_id;
DROP INDEX IF EXISTS idx_comments_parent_id;
ALTER TABLE contest_chat_messages DROP COLUMN IF EXISTS parent_id;
ALTER TABLE contest_comments DROP COLUMN IF EXISTS parent_id;
-- +goose StatementEnd
