-- +goose Up
ALTER TABLE contests
    ADD COLUMN IF NOT EXISTS registration_starts_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN contests.registration_starts_at IS 'Автоматический переход draft → registration при наступлении момента';
COMMENT ON COLUMN contests.registration_ends_at IS 'Конец приёма заявок (информационно для организатора)';
COMMENT ON COLUMN contests.voting_starts_at IS 'Автоматический переход registration → voting';
COMMENT ON COLUMN contests.voting_ends_at IS 'Автоматический переход voting → finished';

-- +goose Down
ALTER TABLE contests DROP COLUMN IF EXISTS registration_starts_at;
