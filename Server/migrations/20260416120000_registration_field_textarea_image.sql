-- +goose Up
-- +goose StatementBegin
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'contest_registration_fields'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%field_type%'
  LOOP
    EXECUTE format('ALTER TABLE contest_registration_fields DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
-- +goose StatementEnd

ALTER TABLE contest_registration_fields
  ADD CONSTRAINT contest_registration_fields_field_type_check
  CHECK (field_type IN ('string', 'number', 'boolean', 'enum', 'textarea', 'image'));

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contest_registration_fields DROP CONSTRAINT IF EXISTS contest_registration_fields_field_type_check;
-- +goose StatementEnd

-- +goose StatementBegin
ALTER TABLE contest_registration_fields
  ADD CONSTRAINT contest_registration_fields_field_type_check
  CHECK (field_type IN ('string', 'number', 'boolean', 'enum'));
-- +goose StatementEnd
