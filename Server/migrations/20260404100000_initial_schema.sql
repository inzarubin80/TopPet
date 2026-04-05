-- +goose Up
-- +goose StatementBegin
-- Единая начальная схема (объединение прежних миграций). Для применения: пустая БД или пересоздание.
-- gen_random_uuid(): на PostgreSQL до версии 15 нужен pgcrypto; на 15+ CREATE EXTENSION безвреден.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email TEXT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'contest_admin', 'system_admin'))
);

CREATE UNIQUE INDEX idx_users_email_unique ON users (email) WHERE email IS NOT NULL;

CREATE TABLE user_auth_providers (
    user_id BIGINT NOT NULL,
    provider_uid VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    PRIMARY KEY (provider_uid, provider)
);

CREATE INDEX idx_user_auth_providers_user_id ON user_auth_providers (user_id);

CREATE TABLE contests (
    id UUID PRIMARY KEY,
    created_by_user_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tier TEXT NOT NULL DEFAULT 'free',
    cover_url TEXT NOT NULL DEFAULT '',
    registration_starts_at TIMESTAMPTZ NULL,
    registration_ends_at TIMESTAMPTZ NULL,
    voting_starts_at TIMESTAMPTZ NULL,
    voting_ends_at TIMESTAMPTZ NULL,
    require_acceptance BOOLEAN NOT NULL DEFAULT FALSE,
    public_voting_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    jury_voting_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    tagline TEXT NOT NULL DEFAULT '',
    rules_url TEXT NOT NULL DEFAULT '',
    prize_text TEXT NOT NULL DEFAULT '',
    logo_url TEXT NOT NULL DEFAULT '',
    theme_color TEXT NOT NULL DEFAULT '',
    sponsor_name TEXT NOT NULL DEFAULT '',
    sponsor_logo_url TEXT NOT NULL DEFAULT '',
    sponsor_url TEXT NOT NULL DEFAULT '',
    cta_label_override TEXT NOT NULL DEFAULT '',
    CONSTRAINT contests_status_check CHECK (status IN ('draft', 'registration', 'voting', 'finished')),
    CONSTRAINT contests_tier_check CHECK (tier IN ('free', 'pro'))
);

CREATE INDEX idx_contests_status_created_at ON contests (status, created_at DESC);
CREATE INDEX idx_contests_created_by_user_id ON contests (created_by_user_id);

COMMENT ON COLUMN contests.jury_voting_enabled IS 'Если true — используются критерии жюри и состав жюри';
COMMENT ON COLUMN contests.public_voting_enabled IS 'Если true — участники могут получать голоса посетителей';

CREATE TABLE contest_nominations (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contest_nominations_contest ON contest_nominations (contest_id, sort_order);

CREATE TABLE contest_jury_members (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uniq_jury_contest_user ON contest_jury_members (contest_id, user_id);
CREATE INDEX idx_jury_contest ON contest_jury_members (contest_id);

CREATE TABLE contest_jury_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    scale_min INT NOT NULL DEFAULT 1,
    scale_max INT NOT NULL DEFAULT 10,
    scale_step INT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contest_jury_criteria_scale_check CHECK (
        scale_min < scale_max
        AND scale_step >= 1
    )
);

CREATE INDEX idx_contest_jury_criteria_contest_id ON contest_jury_criteria (contest_id);

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

CREATE TABLE contest_participants (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    pet_name TEXT NOT NULL,
    pet_description TEXT NOT NULL DEFAULT '',
    nomination_id UUID NULL,
    submission_status TEXT NOT NULL DEFAULT 'accepted',
    submission_comment TEXT NULL,
    owner_last_read_staff_comment_at TIMESTAMPTZ NULL,
    registration_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contest_participants_submission_status_check CHECK (
        submission_status IN ('pending', 'accepted', 'rejected')
    )
);

CREATE INDEX idx_participants_contest_id ON contest_participants (contest_id);
CREATE INDEX idx_participants_user_id ON contest_participants (user_id);
-- Одна заявка на (конкурс, пользователь) без номинации и не более одной на каждую номинацию.
CREATE UNIQUE INDEX uniq_participant_contest_user_nomination_null
ON contest_participants (contest_id, user_id)
WHERE nomination_id IS NULL;
CREATE UNIQUE INDEX uniq_participant_contest_user_nomination_id
ON contest_participants (contest_id, user_id, nomination_id)
WHERE nomination_id IS NOT NULL;

CREATE TABLE contest_participant_photos (
    id UUID PRIMARY KEY,
    participant_id UUID NOT NULL,
    url TEXT NOT NULL,
    thumb_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    position INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_photos_participant_id_created_at ON contest_participant_photos (participant_id, created_at);
CREATE INDEX idx_photos_participant_id_position ON contest_participant_photos (participant_id, position);

CREATE TABLE contest_participant_videos (
    id UUID PRIMARY KEY,
    participant_id UUID NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uniq_video_participant ON contest_participant_videos (participant_id);

CREATE TABLE contest_votes (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    nomination_id UUID NULL REFERENCES contest_nominations (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nomination_slot UUID GENERATED ALWAYS AS (
        COALESCE(nomination_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) STORED
);

CREATE UNIQUE INDEX uniq_votes_contest_user_nom_slot ON contest_votes (contest_id, user_id, nomination_slot);
CREATE INDEX idx_votes_contest_id ON contest_votes (contest_id);
CREATE INDEX idx_votes_participant_id ON contest_votes (participant_id);

CREATE TABLE contest_comments (
    id UUID PRIMARY KEY,
    participant_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_participant_id_created_at ON contest_comments (participant_id, created_at);

CREATE TABLE contest_chat_messages (
    id UUID PRIMARY KEY,
    contest_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    text TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_contest_id_created_at ON contest_chat_messages (contest_id, created_at);

CREATE TABLE payments (
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

CREATE UNIQUE INDEX uniq_payments_provider_payment ON payments (provider, provider_payment_id);
CREATE INDEX idx_payments_user ON payments (user_id);
CREATE INDEX idx_payments_contest ON payments (contest_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS contest_chat_messages;
DROP TABLE IF EXISTS contest_comments;
DROP TABLE IF EXISTS contest_votes;
DROP TABLE IF EXISTS contest_participant_videos;
DROP TABLE IF EXISTS contest_participant_photos;
DROP TABLE IF EXISTS contest_participants;
DROP TABLE IF EXISTS contest_registration_fields;
DROP TABLE IF EXISTS contest_jury_criteria;
DROP TABLE IF EXISTS contest_jury_members;
DROP TABLE IF EXISTS contest_nominations;
DROP TABLE IF EXISTS contests;
DROP TABLE IF EXISTS user_auth_providers;
DROP TABLE IF EXISTS users;
-- +goose StatementEnd
