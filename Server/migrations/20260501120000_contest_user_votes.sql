-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS contest_user_votes (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    nomination_id UUID NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nomination_slot UUID GENERATED ALWAYS AS (
        COALESCE(nomination_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contest_user_votes_contest_user_nom_slot
    ON contest_user_votes (contest_id, user_id, nomination_slot);
CREATE INDEX IF NOT EXISTS idx_contest_user_votes_contest_id
    ON contest_user_votes (contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_user_votes_participant_id
    ON contest_user_votes (participant_id);
CREATE INDEX IF NOT EXISTS idx_contest_user_votes_user_id
    ON contest_user_votes (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS contest_user_votes;
-- +goose StatementEnd
