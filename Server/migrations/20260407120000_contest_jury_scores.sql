-- +goose Up
CREATE TABLE contest_jury_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES contest_participants (id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES contest_jury_criteria (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    score INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uniq_jury_score_participant_criterion_user
ON contest_jury_scores (participant_id, criterion_id, user_id);

CREATE INDEX idx_jury_scores_participant ON contest_jury_scores (participant_id);
CREATE INDEX idx_jury_scores_contest_juror ON contest_jury_scores (criterion_id, user_id);

-- +goose Down
DROP TABLE IF EXISTS contest_jury_scores;
