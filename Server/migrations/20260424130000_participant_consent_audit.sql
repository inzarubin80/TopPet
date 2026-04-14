-- +goose Up
CREATE TABLE IF NOT EXISTS participant_consent_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    consent_type TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT participant_consent_audits_consent_type_check
        CHECK (consent_type IN ('privacy_processing')),
    CONSTRAINT participant_consent_audits_policy_version_not_empty
        CHECK (btrim(policy_version) <> '')
);

CREATE INDEX IF NOT EXISTS idx_participant_consent_audits_participant_id
    ON participant_consent_audits (participant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_participant_consent_audits_user_id
    ON participant_consent_audits (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS participant_consent_audits;
