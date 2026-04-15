-- +goose Up
-- +goose StatementBegin
ALTER TABLE contests
    ADD COLUMN audience_winners_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN jury_winners_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN voting_results_computed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN contests.audience_winners_snapshot IS 'Зафиксированные победители зрительского голосования (JSON массив ContestWinnerBrief)';
COMMENT ON COLUMN contests.jury_winners_snapshot IS 'Зафиксированные победители жюри (JSON массив ContestWinnerBrief)';
COMMENT ON COLUMN contests.voting_results_computed_at IS 'Момент сохранения/последнего пересчёта снимка результатов';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contests
    DROP COLUMN IF EXISTS voting_results_computed_at,
    DROP COLUMN IF EXISTS jury_winners_snapshot,
    DROP COLUMN IF EXISTS audience_winners_snapshot;
-- +goose StatementEnd
