-- +goose Up
ALTER TABLE contest_nominations
    ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN contest_nominations.logo_url IS 'Публичный URL логотипа номинации (object storage), пусто — нет логотипа';

-- +goose Down
ALTER TABLE contest_nominations DROP COLUMN IF EXISTS logo_url;
