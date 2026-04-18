-- +goose Up
-- Вложения к сообщениям чата и комментариям (URL в объектном хранилище; без FK).
ALTER TABLE contest_chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT NULL;
ALTER TABLE contest_comments ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

-- +goose Down
ALTER TABLE contest_chat_messages DROP COLUMN IF EXISTS image_url;
ALTER TABLE contest_comments DROP COLUMN IF EXISTS image_url;
