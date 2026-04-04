-- +goose Up
-- Идемпотентно: в «свежей» схеме из initial_schema колонки уже есть.
-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contest_votes'
          AND column_name = 'nomination_id'
    ) THEN
        ALTER TABLE contest_votes ADD COLUMN nomination_id UUID NULL REFERENCES contest_nominations (id) ON DELETE SET NULL;

        UPDATE contest_votes cv
        SET nomination_id = cp.nomination_id
        FROM contest_participants cp
        WHERE cp.id = cv.participant_id;

        DROP INDEX IF EXISTS uniq_votes_contest_user;

        ALTER TABLE contest_votes ADD COLUMN nomination_slot UUID GENERATED ALWAYS AS (
            COALESCE(nomination_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) STORED;

        CREATE UNIQUE INDEX uniq_votes_contest_user_nom_slot ON contest_votes (contest_id, user_id, nomination_slot);
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contest_votes'
          AND column_name = 'nomination_slot'
    ) THEN
        DROP INDEX IF EXISTS uniq_votes_contest_user_nom_slot;

        ALTER TABLE contest_votes DROP COLUMN nomination_slot;

        DELETE FROM contest_votes a
        WHERE a.ctid NOT IN (
            SELECT DISTINCT ON (contest_id, user_id) ctid
            FROM contest_votes
            ORDER BY contest_id, user_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        );

        ALTER TABLE contest_votes DROP COLUMN nomination_id;

        CREATE UNIQUE INDEX IF NOT EXISTS uniq_votes_contest_user ON contest_votes (contest_id, user_id);
    END IF;
END $$;
-- +goose StatementEnd
