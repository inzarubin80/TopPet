-- +goose Up
-- +goose StatementBegin
ALTER TABLE contests
    ADD COLUMN jury_prize_places JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN audience_prize_places JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN contests.jury_prize_places IS 'Список призовых мест жюри в формате JSON: [{"place":1,"prize":"..."}]';
COMMENT ON COLUMN contests.audience_prize_places IS 'Список мест зрительских симпатий в формате JSON: [{"place":1,"prize":"..."}]';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contests
    DROP COLUMN IF EXISTS audience_prize_places,
    DROP COLUMN IF EXISTS jury_prize_places;
-- +goose StatementEnd
