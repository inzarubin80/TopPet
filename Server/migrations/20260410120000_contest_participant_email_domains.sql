-- +goose Up
-- Ограничение участников по домену e-mail (корпоративные конкурсы). Пустая строка — без ограничения.
ALTER TABLE contests
    ADD COLUMN IF NOT EXISTS participant_allowed_email_domains TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN contests.participant_allowed_email_domains IS 'Домены e-mail (разделители: перевод строки, запятая), нижний регистр; пусто — участвовать может любой авторизованный пользователь.';

-- +goose Down
ALTER TABLE contests DROP COLUMN IF EXISTS participant_allowed_email_domains;
