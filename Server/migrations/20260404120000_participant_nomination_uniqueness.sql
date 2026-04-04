-- +goose Up
-- Одна заявка с общей номинацией (NULL) и отдельные заявки на каждую номинацию с заполненным nomination_id.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_participant_contest_user_nomination_null
ON contest_participants (contest_id, user_id)
WHERE nomination_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_participant_contest_user_nomination_id
ON contest_participants (contest_id, user_id, nomination_id)
WHERE nomination_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS uniq_participant_contest_user_nomination_id;
DROP INDEX IF EXISTS uniq_participant_contest_user_nomination_null;
