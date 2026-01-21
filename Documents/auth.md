# Auth

Цель: повторить подход GreenWarden (`https://github.com/inzarubin80/GreenWarden/tree/main/Server`):\n
- Access JWT (короткий TTL)\n
- Refresh token (длинный TTL)\n
- Auth middleware проверяет access token из `Authorization: Bearer ...` или query `accessToken=...`\n

## Режимы
### MVP (dev)
Для ускорения разработки используется `POST /api/auth/dev-login`:\n
- создает пользователя (если нужно)\n
- выдает access + refresh\n

### Prod (позже)
Переносим OAuth flow (login -> callback -> exchange -> refresh) по GreenWarden.\n

## Middleware
- Для всех mutating endpoints подключаем auth middleware.\n
- В `context` кладем `user_id`.\n

