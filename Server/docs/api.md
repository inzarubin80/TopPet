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

#### GET /api/contests/{contestId}/participants/{participantId}
Получить информацию об участнике.

#### POST /api/contests/{contestId}/participants
Создать участника. Требует аутентификации.

**Request:**
```json
{
  "pet_name": "string",
  "pet_description": "string"
}
```

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

#### GET /api/photos/{photoId}/like
Получить информацию о лайках фото (опциональная аутентификация).

#### POST /api/photos/{photoId}/like
Лайкнуть фото. Требует аутентификации.

#### DELETE /api/photos/{photoId}/like
Убрать лайк с фото. Требует аутентификации.

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
