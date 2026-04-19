-- +goose Up
CREATE TABLE user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    kind TEXT NOT NULL,
    payload JSONB NOT NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_notifications_user_created ON user_notifications (user_id, created_at DESC);
CREATE INDEX idx_user_notifications_user_unread ON user_notifications (user_id) WHERE read_at IS NULL;

COMMENT ON TABLE user_notifications IS 'In-app notifications per user (no FK to users by project convention).';
COMMENT ON COLUMN user_notifications.kind IS 'Stable kind: submission_accepted, submission_rejected, chat_reply, ...';

-- +goose Down
DROP TABLE IF EXISTS user_notifications;
