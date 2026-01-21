# WebSocket: чат конкурса

Ориентир: WebSocket hub как в GreenWarden (`https://github.com/inzarubin80/GreenWarden/tree/main/Server`).

## Endpoint
- `GET /api/contests/{contestId}/chat/ws`

Авторизация:\n
- `Authorization: Bearer {accessToken}`\n
или\n
- query `?accessToken={accessToken}`\n

## Inbound сообщения (client -> server)
1) Subscribe\n
```json
{ "type": "subscribe", "contest_id": "uuid" }
```

2) Message\n
```json
{ "type": "message", "contest_id": "uuid", "text": "..." }
```

## Outbound события (server -> client)
1) New message\n
```json
{
  "type": "new_message",
  "contest_id": "uuid",
  "message": {
    "id": "uuid",
    "contest_id": "uuid",
    "user_id": 123,
    "text": "...",
    "is_system": false,
    "created_at": "2026-01-21T00:00:00Z",
    "updated_at": "2026-01-21T00:00:00Z"
  }
}
```

## Ограничения
- Читать историю чата можно без авторизации (HTTP endpoint).
- Отправлять сообщения — только с валидным access token.
- `text` ограничиваем по длине на стороне сервера (например, 2000 символов).

