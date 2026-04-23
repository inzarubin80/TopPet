-- +goose Up
CREATE TABLE direct_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_low_id BIGINT NOT NULL,
    user_high_id BIGINT NOT NULL,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_low_id, user_high_id),
    CHECK (user_low_id < user_high_id)
);

CREATE INDEX idx_direct_conversations_user_low_last_message
    ON direct_conversations (user_low_id, last_message_at DESC);
CREATE INDEX idx_direct_conversations_user_high_last_message
    ON direct_conversations (user_high_id, last_message_at DESC);

CREATE TABLE direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_user_id BIGINT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_direct_messages_conversation_created
    ON direct_messages (conversation_id, created_at ASC);
CREATE INDEX idx_direct_messages_sender_created
    ON direct_messages (sender_user_id, created_at DESC);

COMMENT ON TABLE direct_conversations IS 'Private user-to-user conversations (no FK by project rule).';
COMMENT ON TABLE direct_messages IS 'Messages inside private conversations (no FK by project rule).';

-- +goose Down
DROP TABLE IF EXISTS direct_messages;
DROP TABLE IF EXISTS direct_conversations;
