# Auth

Цель: повторить подход GreenWarden (`https://github.com/inzarubin80/GreenWarden/tree/main/Server`):\n
- Access JWT (короткий TTL)\n
- Refresh token (длинный TTL)\n
- Auth middleware проверяет access token из `Authorization: Bearer ...` или query `accessToken=...`\n

## OAuth Flow
Используется OAuth flow (login -> callback -> exchange -> refresh) по GreenWarden.\n
- Поддерживаемые провайдеры: Yandex, Google, VK\n
- PKCE (Proof Key for Code Exchange) для безопасности (кроме VK)\n
- После авторизации выдается access + refresh токены\n

## Middleware
- Для всех mutating endpoints подключаем auth middleware.\n
- В `context` кладем `user_id`.\n

