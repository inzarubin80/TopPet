-- +goose Up
-- +goose StatementBegin
CREATE TABLE contest_participant_photos (
    id UUID PRIMARY KEY,
    participant_id UUID NOT NULL,
    url TEXT NOT NULL,
    thumb_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_photos_participant_id_created_at ON contest_participant_photos (participant_id, created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_photos_participant_id_created_at;
DROP TABLE IF EXISTS contest_participant_photos;
-- +goose StatementEnd
