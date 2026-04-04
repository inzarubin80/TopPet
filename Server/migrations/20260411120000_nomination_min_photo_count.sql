-- +goose Up
ALTER TABLE contest_nominations
    ADD COLUMN IF NOT EXISTS min_photo_count INT NOT NULL DEFAULT 1;

ALTER TABLE contest_nominations
    DROP CONSTRAINT IF EXISTS contest_nominations_min_photo_count_check;

ALTER TABLE contest_nominations
    ADD CONSTRAINT contest_nominations_min_photo_count_check
    CHECK (min_photo_count >= 1 AND min_photo_count <= 30);

COMMENT ON COLUMN contest_nominations.min_photo_count IS 'Минимальное число фото в заявке для этой номинации (по умолчанию 1).';

-- +goose Down
ALTER TABLE contest_nominations DROP CONSTRAINT IF EXISTS contest_nominations_min_photo_count_check;
ALTER TABLE contest_nominations DROP COLUMN IF EXISTS min_photo_count;
