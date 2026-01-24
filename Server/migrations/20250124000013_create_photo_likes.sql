-- +goose Up
-- +goose StatementBegin
CREATE TABLE photo_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uniq_photo_likes_photo_user ON photo_likes (photo_id, user_id);
CREATE INDEX idx_photo_likes_photo_id ON photo_likes (photo_id);
CREATE INDEX idx_photo_likes_user_id ON photo_likes (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_photo_likes_user_id;
DROP INDEX IF EXISTS idx_photo_likes_photo_id;
DROP INDEX IF EXISTS uniq_photo_likes_photo_user;
DROP TABLE IF EXISTS photo_likes;
-- +goose StatementEnd
