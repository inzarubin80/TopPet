-- +goose Up
-- +goose StatementBegin
ALTER TABLE contests
    ADD COLUMN IF NOT EXISTS user_voting_mode TEXT NOT NULL DEFAULT 'likes';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'contests_user_voting_mode_check'
    ) THEN
        ALTER TABLE contests
            ADD CONSTRAINT contests_user_voting_mode_check
            CHECK (user_voting_mode IN ('likes', 'all_users', 'participants_only'));
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contests DROP CONSTRAINT IF EXISTS contests_user_voting_mode_check;
ALTER TABLE contests DROP COLUMN IF EXISTS user_voting_mode;
-- +goose StatementEnd
