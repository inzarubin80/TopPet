-- +goose Up
-- +goose StatementBegin
UPDATE contests
SET status = 'registration'
WHERE status = 'published';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE contests
SET status = 'published'
WHERE status = 'registration';
-- +goose StatementEnd
