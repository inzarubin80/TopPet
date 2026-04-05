-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'rules_url'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'rules_text'
    ) THEN
      ALTER TABLE contests ADD COLUMN rules_text TEXT NOT NULL DEFAULT '';
    END IF;
    UPDATE contests
    SET rules_text = rules_url
    WHERE btrim(COALESCE(rules_url, '')) <> ''
      AND btrim(COALESCE(rules_text, '')) = '';
    ALTER TABLE contests DROP COLUMN rules_url;
  END IF;
END $$;
-- +goose StatementEnd

COMMENT ON COLUMN contests.rules_text IS 'Полный текст правил конкурса (многострочный); пусто — блок не показывается.';

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'rules_text'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'rules_url'
  ) THEN
    ALTER TABLE contests ADD COLUMN rules_url TEXT NOT NULL DEFAULT '';
    UPDATE contests
    SET rules_url = LEFT(regexp_replace(rules_text, E'[\\n\\r]+', ' ', 'g'), 2000)
    WHERE btrim(COALESCE(rules_text, '')) <> '';
    ALTER TABLE contests DROP COLUMN rules_text;
  END IF;
END $$;
-- +goose StatementEnd
