-- +goose Up
ALTER TABLE contest_registration_fields
    ADD COLUMN help_text TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN contest_registration_fields.help_text IS 'Пояснение для участника при заполнении поля заявки';

-- +goose Down
ALTER TABLE contest_registration_fields DROP COLUMN IF EXISTS help_text;
