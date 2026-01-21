-- +goose Up
-- +goose StatementBegin
CREATE TABLE contest_participant_videos (
    id UUID PRIMARY KEY,
    participant_id UUID NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uniq_video_participant ON contest_participant_videos (participant_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS uniq_video_participant;
DROP TABLE IF EXISTS contest_participant_videos;
-- +goose StatementEnd
