-- +goose Up
DROP TABLE IF EXISTS contest_participant_videos;

-- +goose Down
CREATE TABLE IF NOT EXISTS contest_participant_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES contest_participants (id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (participant_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_participant_videos_participant
    ON contest_participant_videos (participant_id);
