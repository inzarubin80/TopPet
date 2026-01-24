# DB (Postgres, без FK)

Ключевая политика: **не используем FOREIGN KEY**. Связи обеспечиваются:\n
- индексами\n
- проверками на уровне service\n
- уникальными ограничениями для бизнес-правил\n

## Таблицы

### `users`
- `user_id BIGSERIAL PRIMARY KEY`
- `name TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### `contests`
- `id UUID PRIMARY KEY`
- `created_by_user_id BIGINT NOT NULL`
- `title TEXT NOT NULL`
- `description TEXT NOT NULL DEFAULT ''`
- `status TEXT NOT NULL CHECK (status IN ('draft','registration','voting','finished'))`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Индексы:\n
- `idx_contests_status_created_at (status, created_at DESC)`\n
- `idx_contests_created_by_user_id (created_by_user_id)`\n

### `contest_participants`
- `id UUID PRIMARY KEY`
- `contest_id UUID NOT NULL`
- `user_id BIGINT NOT NULL`
- `pet_name TEXT NOT NULL`
- `pet_description TEXT NOT NULL DEFAULT ''`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Индексы/уникальность:\n
- `idx_participants_contest_id (contest_id)`\n
- `idx_participants_user_id (user_id)`\n
- `uniq_participants_contest_user (contest_id, user_id)` (MVP: 1 карточка на пользователя на конкурс)\n

### `contest_participant_photos`
- `id UUID PRIMARY KEY`
- `participant_id UUID NOT NULL`
- `url TEXT NOT NULL`
- `thumb_url TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Индексы:\n
- `idx_photos_participant_id_created_at (participant_id, created_at)`\n

### `contest_participant_videos`
- `id UUID PRIMARY KEY`
- `participant_id UUID NOT NULL`
- `url TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Индексы:\n
- `uniq_video_participant (participant_id)` (MVP: 0..1 видео)\n

### `contest_votes`
- `id UUID PRIMARY KEY`
- `contest_id UUID NOT NULL`
- `participant_id UUID NOT NULL`
- `user_id BIGINT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Уникальность:\n
- `uniq_votes_contest_user (contest_id, user_id)` — обеспечивает «1 голос на конкурс» + upsert («последний выбор»).\n

Индексы:\n
- `idx_votes_contest_id (contest_id)`\n
- `idx_votes_participant_id (participant_id)`\n

### `contest_comments`
- `id UUID PRIMARY KEY`
- `participant_id UUID NOT NULL`
- `user_id BIGINT NOT NULL`
- `text TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Индексы:\n
- `idx_comments_participant_id_created_at (participant_id, created_at)`\n

### `contest_chat_messages`
- `id UUID PRIMARY KEY`
- `contest_id UUID NOT NULL`
- `user_id BIGINT NOT NULL`
- `text TEXT NOT NULL`
- `is_system BOOLEAN NOT NULL DEFAULT FALSE`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Индексы:\n
- `idx_chat_contest_id_created_at (contest_id, created_at)`\n

## Примечания по агрегатам голосов
Чтобы не раскрывать рейтинг, API может отдавать только:\n
- `total_votes` по конкурсу (count по `contest_votes`)\n
- `total_votes` по карточке (count по `contest_votes` with participant_id)\n
без сортировок и без выдачи списков лидеров.\n

