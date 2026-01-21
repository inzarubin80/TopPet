-- +goose Up
-- +goose StatementBegin
CREATE TABLE user_auth_providers (
    user_id BIGINT NOT NULL,
    provider_uid VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    PRIMARY KEY (provider_uid, provider)
);

CREATE INDEX idx_user_auth_providers_user_id ON user_auth_providers (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_user_auth_providers_user_id;
DROP TABLE IF EXISTS user_auth_providers;
-- +goose StatementEnd
