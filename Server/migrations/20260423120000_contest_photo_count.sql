-- +goose Up
ALTER TABLE contests
    ADD COLUMN IF NOT EXISTS min_photo_count INT NOT NULL DEFAULT 1;

ALTER TABLE contests
    ADD COLUMN IF NOT EXISTS max_photo_count INT NOT NULL DEFAULT 30;

ALTER TABLE contests
    DROP CONSTRAINT IF EXISTS contests_min_photo_count_check;

ALTER TABLE contests
    ADD CONSTRAINT contests_min_photo_count_check
    CHECK (min_photo_count >= 1 AND min_photo_count <= 30);

ALTER TABLE contests
    DROP CONSTRAINT IF EXISTS contests_max_photo_count_check;

ALTER TABLE contests
    ADD CONSTRAINT contests_max_photo_count_check
    CHECK (max_photo_count >= 1 AND max_photo_count <= 30);

ALTER TABLE contests
    DROP CONSTRAINT IF EXISTS contests_min_max_photo_check;

ALTER TABLE contests
    ADD CONSTRAINT contests_min_max_photo_check
    CHECK (min_photo_count <= max_photo_count);

COMMENT ON COLUMN contests.min_photo_count IS 'Минимальное число фото в заявке для конкурса (1–30).';
COMMENT ON COLUMN contests.max_photo_count IS 'Максимальное число фото в заявке для конкурса (1–30, не меньше min_photo_count).';

UPDATE contest_nominations n
SET
    min_photo_count = c.min_photo_count,
    max_photo_count = c.max_photo_count
FROM contests c
WHERE n.contest_id = c.id;

-- +goose Down
ALTER TABLE contests DROP CONSTRAINT IF EXISTS contests_min_max_photo_check;
ALTER TABLE contests DROP CONSTRAINT IF EXISTS contests_max_photo_count_check;
ALTER TABLE contests DROP CONSTRAINT IF EXISTS contests_min_photo_count_check;
ALTER TABLE contests DROP COLUMN IF EXISTS max_photo_count;
ALTER TABLE contests DROP COLUMN IF EXISTS min_photo_count;
