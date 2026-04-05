-- +goose Up
ALTER TABLE contests DROP CONSTRAINT contests_status_check;
ALTER TABLE contests ADD CONSTRAINT contests_status_check CHECK (status IN ('draft', 'publication', 'registration', 'voting', 'finished'));

-- +goose Down
ALTER TABLE contests DROP CONSTRAINT contests_status_check;
ALTER TABLE contests ADD CONSTRAINT contests_status_check CHECK (status IN ('draft', 'registration', 'voting', 'finished'));
