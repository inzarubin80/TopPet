# API Documentation

## Base URL
```
http://localhost:8080/api
```

## Authentication

Большинство endpoints требуют аутентификации через JWT токен. Токен передается в заголовке:
```
Authorization: Bearer <access_token>
```

Или в query параметре:
```
?access_token=<access_token>
```

## Endpoints

### Health Check

#### GET /api/ping
Проверка работоспособности сервера.

**Response:**
```json
{
  "data": {
    "status": "ok"
  }
}
```

### Authentication

#### POST /api/auth/login
Инициирует процесс OAuth авторизации.

**Request:**
```json
{
  "provider": "yandex|google|vk",
  "code_challenge": "string",
  "code_verifier": "string",
  "action": "login|link"
}
```

**Response:**
```json
{
  "data": {
    "auth_url": "string",
    "state": "string"
  }
}
```

#### GET /api/auth/callback
OAuth callback endpoint (используется провайдером).

#### POST /api/auth/refresh
Обновляет access token используя refresh token.

**Request:**
```json
{
  "refresh_token": "string"
}
```

**Response:**
```json
{
  "data": {
    "token": "string",
    "refresh_token": "string",
    "user_id": 1
  }
}
```

#### GET /api/auth/me
Получить информацию о текущем пользователе. Требует аутентификации.

**Response:**
```json
{
  "data": {
    "id": 1,
    "name": "string",
    "avatar_url": "string",
    "created_at": "2026-01-24T00:00:00Z"
  }
}
```

#### PATCH /api/auth/me
Обновить информацию о текущем пользователе. Требует аутентификации.

**Request:**
```json
{
  "name": "string"
}
```

### Contests

#### GET /api/contests
Получить список конкурсов.

**Query Parameters:**
- `status` (optional): фильтр по статусу (draft, registration, voting, finished)
- `limit` (optional): количество результатов (default: 20, max: 100)
- `offset` (optional): смещение для пагинации (default: 0)

**Response:**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "created_by_user_id": 1,
        "title": "string",
        "description": "string",
        "status": "draft|registration|voting|finished",
        "total_votes": 0,
        "created_at": "2026-01-24T00:00:00Z",
        "updated_at": "2026-01-24T00:00:00Z"
      }
    ],
    "total": 10
  }
}
```

#### GET /api/contests/{contestId}
Получить информацию о конкурсе.

#### POST /api/contests
Создать новый конкурс. Требует аутентификации.

**Request:**
```json
{
  "title": "string",
  "description": "string"
}
```

#### PATCH /api/contests/{contestId}
Обновить конкурс. Требует аутентификации. Только создатель может обновить.

Дополнительно поддерживаются поля:
- `jury_prize_places`: массив мест жюри в формате `[{ "place": 1, "prize": "1000 рублей" }]`
- `audience_prize_places`: массив мест зрительских симпатий в том же формате

Правила валидации: `place >= 1`, места уникальны в рамках массива, `prize` не пустой.

#### PATCH /api/contests/{contestId}/status
Обновить статус конкурса. Требует аутентификации. Только создатель может обновить.

**Request:**
```json
{
  "status": "draft|registration|voting|finished"
}
```

#### DELETE /api/contests/{contestId}
Удалить конкурс. Требует аутентификации. Только создатель может удалить.

### Participants

#### GET /api/contests/{contestId}/participants
Получить список участников конкурса.

Query `sort` (опционально): `votes` — по числу голосов зрителей (убыв.), `jury` — по сумме баллов жюри (убыв.), `created_at` — по дате подачи заявки. Без параметра: для фаз голосования и завершения — как `votes`, иначе как `created_at`.

#### GET /api/contests/{contestId}/participants/{participantId}
Получить информацию об участнике.

Для завершённых конкурсов у призёров дополнительно заполняются:
- `audience_winner_place`, `audience_winner_prize`
- `jury_winner_place`, `jury_winner_prize`

#### POST /api/contests/{contestId}/participants
Создать участника. Требует аутентификации.

**Request:**
```json
{
  "entry_title": "string",
  "entry_description": "string",
  "author_name": "string",
  "nomination_id": "uuid",
  "registration_answers": {},
  "privacy_consent": true,
  "policy_version": "2026-04-14",
  "publication_consent": true,
  "publication_terms_version": "2026-04-19",
  "contest_rules_consent": true
}
```

`privacy_consent` должен быть `true`, `policy_version` — непустая строка версии политики; `publication_consent` — `true`, `publication_terms_version` — версия пользовательского соглашения. Если у конкурса задан непустой `rules_text`, необходимо `contest_rules_consent: true`.

#### PATCH /api/participants/{participantId}
Обновить участника. Требует аутентификации.

#### DELETE /api/participants/{participantId}
Удалить участника. Требует аутентификации.

### Votes

#### GET /api/contests/{contestId}/vote
Получить голос текущего пользователя (опциональная аутентификация).

#### POST /api/contests/{contestId}/vote
Проголосовать. Требует аутентификации.

**Request:**
```json
{
  "participant_id": "uuid"
}
```

#### DELETE /api/contests/{contestId}/vote
Отменить голос. Требует аутентификации.

### Comments

#### GET /api/participants/{participantId}/comments
Получить комментарии участника.

**Query Parameters:**
- `limit` (optional): количество результатов (default: 20)
- `offset` (optional): смещение для пагинации (default: 0)

#### POST /api/participants/{participantId}/comments
Создать комментарий. Требует аутентификации.

**Request:**
```json
{
  "text": "string"
}
```

#### PATCH /api/comments/{commentId}
Обновить комментарий. Требует аутентификации.

#### DELETE /api/comments/{commentId}
Удалить комментарий. Требует аутентификации.

### Chat

#### GET /api/contests/{contestId}/chat
Получить сообщения чата конкурса.

**Query Parameters:**
- `limit` (optional): количество результатов (default: 50)
- `offset` (optional): смещение для пагинации (default: 0)

#### GET /api/contests/{contestId}/chat/ws
WebSocket endpoint для чата конкурса.

#### PATCH /api/chat/{messageId}
Обновить сообщение чата. Требует аутентификации.

#### DELETE /api/chat/{messageId}
Удалить сообщение чата. Требует аутентификации.

### Photos

#### POST /api/participants/{participantId}/photos
Загрузить фото участника. Требует аутентификации.

**Request:** multipart/form-data
- `file`: файл изображения

#### DELETE /api/participants/{participantId}/photos/{photoId}
Удалить фото. Требует аутентификации.

#### PATCH /api/participants/{participantId}/photos/order
Обновить порядок фото. Требует аутентификации.

**Request:**
```json
{
  "photo_ids": ["uuid1", "uuid2", "uuid3"]
}
```

## Error Responses

Все ошибки возвращаются в следующем формате:

```json
{
  "error": true,
  "message": "error message"
}
```

HTTP статус коды:
- `400` - Bad Request (неверный запрос)
- `401` - Unauthorized (требуется аутентификация)
- `403` - Forbidden (нет доступа)
- `404` - Not Found (ресурс не найден)
- `500` - Internal Server Error (внутренняя ошибка сервера)
