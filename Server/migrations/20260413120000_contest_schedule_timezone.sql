-- +goose Up
ALTER TABLE contests
    ADD COLUMN IF NOT EXISTS schedule_timezone TEXT NOT NULL DEFAULT 'Europe/Moscow';

COMMENT ON COLUMN contests.schedule_timezone IS 'IANA TZ для ввода расписания организатором (даты в API по-прежнему UTC)';

-- +goose Down
ALTER TABLE contests DROP COLUMN IF EXISTS schedule_timezone;
