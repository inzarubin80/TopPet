-- +goose Up
-- +goose StatementBegin
CREATE TABLE contests (
    id UUID PRIMARY KEY,
    created_by_user_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('draft','registration','voting','finished')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contests_status_created_at ON contests (status, created_at DESC);
CREATE INDEX idx_contests_created_by_user_id ON contests (created_by_user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_contests_created_by_user_id;
DROP INDEX IF EXISTS idx_contests_status_created_at;
DROP TABLE IF EXISTS contests;
-- +goose StatementEnd
