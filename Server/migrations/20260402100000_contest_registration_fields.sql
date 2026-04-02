-- Поля заявки участника (настраивает организатор): строка, число, флаг, перечисление.
CREATE TABLE contest_registration_fields (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('string', 'number', 'boolean', 'enum')),
    required BOOLEAN NOT NULL DEFAULT FALSE,
    enum_options JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contest_registration_fields_contest_id ON contest_registration_fields (contest_id);

ALTER TABLE contest_participants
ADD COLUMN IF NOT EXISTS registration_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
