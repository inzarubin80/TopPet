-- +goose Up
-- +goose StatementBegin
ALTER TABLE contests ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE contests ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT '';
ALTER TABLE contests ADD COLUMN IF NOT EXISTS registration_ends_at TIMESTAMPTZ NULL;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS voting_starts_at TIMESTAMPTZ NULL;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS voting_ends_at TIMESTAMPTZ NULL;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS require_acceptance BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE contests DROP CONSTRAINT IF EXISTS contests_tier_check;
ALTER TABLE contests ADD CONSTRAINT contests_tier_check CHECK (tier IN ('free', 'pro'));

CREATE TABLE IF NOT EXISTS contest_nominations (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contest_nominations_contest ON contest_nominations (contest_id, sort_order);

CREATE TABLE IF NOT EXISTS contest_jury_members (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_jury_contest_user ON contest_jury_members (contest_id, user_id);
CREATE INDEX IF NOT EXISTS idx_jury_contest ON contest_jury_members (contest_id);

ALTER TABLE contest_participants
    ADD COLUMN IF NOT EXISTS nomination_id UUID NULL,
    ADD COLUMN IF NOT EXISTS submission_status TEXT NOT NULL DEFAULT 'accepted';

ALTER TABLE contest_participants DROP CONSTRAINT IF EXISTS contest_participants_submission_status_check;
ALTER TABLE contest_participants ADD CONSTRAINT contest_participants_submission_status_check
    CHECK (submission_status IN ('pending', 'accepted', 'rejected'));

UPDATE contest_participants SET submission_status = 'accepted' WHERE submission_status IS NULL;

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider TEXT NOT NULL,
    provider_payment_id TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RUB',
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'canceled', 'refunded')),
    contest_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_provider_payment ON payments (provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_contest ON payments (contest_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS payments;
ALTER TABLE contest_participants DROP COLUMN IF EXISTS nomination_id;
ALTER TABLE contest_participants DROP COLUMN IF EXISTS submission_status;
DROP TABLE IF EXISTS contest_jury_members;
DROP TABLE IF EXISTS contest_nominations;
ALTER TABLE contests DROP COLUMN IF EXISTS tier;
ALTER TABLE contests DROP COLUMN IF EXISTS cover_url;
ALTER TABLE contests DROP COLUMN IF EXISTS registration_ends_at;
ALTER TABLE contests DROP COLUMN IF EXISTS voting_starts_at;
ALTER TABLE contests DROP COLUMN IF EXISTS voting_ends_at;
ALTER TABLE contests DROP COLUMN IF EXISTS require_acceptance;
-- +goose StatementEnd
