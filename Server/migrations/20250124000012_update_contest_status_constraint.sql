-- +goose Up
-- +goose StatementBegin
ALTER TABLE contests
    DROP CONSTRAINT IF EXISTS contests_status_check;

ALTER TABLE contests
    ADD CONSTRAINT contests_status_check
    CHECK (status IN ('draft','registration','voting','finished'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contests
    DROP CONSTRAINT IF EXISTS contests_status_check;

ALTER TABLE contests
    ADD CONSTRAINT contests_status_check
    CHECK (status IN ('draft','published','finished'));
-- +goose StatementEnd
