-- +goose Up
ALTER TABLE contest_jury_criteria
ADD COLUMN weight DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD CONSTRAINT contest_jury_criteria_weight_positive CHECK (weight > 0);

-- +goose Down
ALTER TABLE contest_jury_criteria DROP CONSTRAINT IF EXISTS contest_jury_criteria_weight_positive;
ALTER TABLE contest_jury_criteria DROP COLUMN IF EXISTS weight;
