-- +goose Up
ALTER TABLE contests DROP COLUMN IF EXISTS registration_ends_at;

COMMENT ON COLUMN contests.voting_starts_at IS 'Автоматический переход registration → voting; момент окончания приёма заявок';

-- +goose Down
ALTER TABLE contests ADD COLUMN registration_ends_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN contests.voting_starts_at IS 'Автоматический переход registration → voting';
