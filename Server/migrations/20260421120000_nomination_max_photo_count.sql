-- +goose Up
ALTER TABLE contest_nominations
    ADD COLUMN IF NOT EXISTS max_photo_count INT NOT NULL DEFAULT 30;

ALTER TABLE contest_nominations
    DROP CONSTRAINT IF EXISTS contest_nominations_max_photo_count_check;

ALTER TABLE contest_nominations
    ADD CONSTRAINT contest_nominations_max_photo_count_check
    CHECK (max_photo_count >= 1 AND max_photo_count <= 30);

ALTER TABLE contest_nominations
    DROP CONSTRAINT IF EXISTS contest_nominations_min_max_photo_check;

ALTER TABLE contest_nominations
    ADD CONSTRAINT contest_nominations_min_max_photo_check
    CHECK (min_photo_count <= max_photo_count);

COMMENT ON COLUMN contest_nominations.max_photo_count IS 'Максимальное число фото в заявке для этой номинации (1–30, не меньше min_photo_count).';

-- +goose Down
ALTER TABLE contest_nominations DROP CONSTRAINT IF EXISTS contest_nominations_min_max_photo_check;
ALTER TABLE contest_nominations DROP CONSTRAINT IF EXISTS contest_nominations_max_photo_count_check;
ALTER TABLE contest_nominations DROP COLUMN IF EXISTS max_photo_count;
