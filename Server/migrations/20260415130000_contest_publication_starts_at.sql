-- +goose Up
ALTER TABLE contests ADD COLUMN IF NOT EXISTS publication_starts_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN contests.publication_starts_at IS 'Автоматический переход draft → publication при наступлении момента';

-- +goose Down
ALTER TABLE contests DROP COLUMN IF EXISTS publication_starts_at;
