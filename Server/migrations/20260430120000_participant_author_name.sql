-- +goose Up
-- +goose StatementBegin
ALTER TABLE contest_participants
    ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT '';

UPDATE contest_participants cp
SET author_name = COALESCE(NULLIF(btrim(u.name), ''), 'Пользователь ' || cp.user_id::text)
FROM users u
WHERE u.user_id = cp.user_id
  AND btrim(cp.author_name) = '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contest_participants
    DROP COLUMN IF EXISTS author_name;
-- +goose StatementEnd
