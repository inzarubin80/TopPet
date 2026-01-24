-- +goose Up
-- +goose StatementBegin
ALTER TABLE contest_participant_photos
ADD COLUMN position INT;

WITH ordered AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY participant_id ORDER BY created_at ASC) AS rn
    FROM contest_participant_photos
)
UPDATE contest_participant_photos
SET position = ordered.rn
FROM ordered
WHERE contest_participant_photos.id = ordered.id;

ALTER TABLE contest_participant_photos
ALTER COLUMN position SET NOT NULL;

CREATE INDEX idx_photos_participant_id_position
ON contest_participant_photos (participant_id, position);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_photos_participant_id_position;
ALTER TABLE contest_participant_photos
DROP COLUMN IF EXISTS position;
-- +goose StatementEnd
