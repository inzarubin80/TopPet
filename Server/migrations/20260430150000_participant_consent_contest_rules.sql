-- +goose Up
ALTER TABLE participant_consent_audits DROP CONSTRAINT IF EXISTS participant_consent_audits_consent_type_check;

ALTER TABLE participant_consent_audits ADD CONSTRAINT participant_consent_audits_consent_type_check
    CHECK (consent_type IN ('privacy_processing', 'work_publication', 'contest_rules'));

-- +goose Down
ALTER TABLE participant_consent_audits DROP CONSTRAINT IF EXISTS participant_consent_audits_consent_type_check;

ALTER TABLE participant_consent_audits ADD CONSTRAINT participant_consent_audits_consent_type_check
    CHECK (consent_type IN ('privacy_processing', 'work_publication'));
