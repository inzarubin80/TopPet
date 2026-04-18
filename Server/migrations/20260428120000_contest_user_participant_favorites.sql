-- +goose Up
CREATE TABLE contest_user_participant_favorites (
    user_id BIGINT NOT NULL,
    participant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contest_user_participant_favorites_pkey PRIMARY KEY (user_id, participant_id)
);

CREATE INDEX idx_cupf_participant_id ON contest_user_participant_favorites (participant_id);

-- +goose Down
DROP TABLE IF EXISTS contest_user_participant_favorites;
