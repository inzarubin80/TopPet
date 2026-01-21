# API (черновой контракт)

Базовый префикс: `/api`.

## Auth (ориентир GreenWarden)
В MVP сервер включает **dev-login** для локальной разработки; в продакшене заменяется на OAuth flow как в GreenWarden (`https://github.com/inzarubin80/GreenWarden/tree/main/Server`).

- `POST /api/auth/dev-login` (auth: no)\n
  - body: `{ \"name\": string }`\n
  - resp: `{ \"token\": string, \"refresh_token\": string, \"user_id\": number }`\n
- `POST /api/auth/refresh` (auth: no)\n
  - body: `{ \"refresh_token\": string }` (или cookie)\n
  - resp: `{ \"token\": string, \"refresh_token\": string, \"user_id\": number }`\n

## Contests (public)
- `GET /api/contests`\n
  - query: `status?`, `limit?`, `offset?`\n
  - resp: `{ items: Contest[], total: number }`\n
- `GET /api/contests/{contestId}`\n
  - resp: `ContestDetails`\n

## Contests (auth required)
- `POST /api/contests`\n
  - body: `{ title, description }`\n
  - resp: `Contest`\n
- `PATCH /api/contests/{contestId}` (только admin, только draft)\n
  - body: `{ title?, description? }`\n
  - resp: `Contest`\n
- `POST /api/contests/{contestId}/publish` (admin)\n
  - resp: `Contest`\n
- `POST /api/contests/{contestId}/finish` (admin)\n
  - resp: `Contest`\n

## Participants (public)
- `GET /api/contests/{contestId}/participants/{participantId}`\n
  - resp: `ParticipantDetails`\n

## Participants (auth required)
- `POST /api/contests/{contestId}/participants`\n
  - body: `{ pet_name, pet_description }`\n
  - resp: `Participant`\n
- `POST /api/participants/{participantId}/photos` (multipart)\n
  - form: `file`\n
  - resp: `Photo`\n
- `POST /api/participants/{participantId}/video` (multipart)\n
  - form: `file`\n
  - resp: `Video`\n

## Votes
- `GET /api/contests/{contestId}/vote` (auth optional)\n
  - если auth: resp `{ participant_id: string } | { participant_id: \"\" }`\n
  - если no auth: 401 или 204 (на выбор клиента)\n
- `POST /api/contests/{contestId}/vote` (auth required, только published)\n
  - body: `{ participant_id: string }`\n
  - resp: `{ participant_id: string }`\n

## Comments (public)
- `GET /api/participants/{participantId}/comments`\n
  - query: `limit?`, `offset?`\n
  - resp: `{ items: Comment[], total: number }`\n

## Comments (auth required)
- `POST /api/participants/{participantId}/comments`\n
  - body: `{ text }`\n
  - resp: `Comment`\n
- `PATCH /api/comments/{commentId}` (author)\n
  - body: `{ text }`\n
  - resp: `Comment`\n
- `DELETE /api/comments/{commentId}` (author)\n
  - resp: `{ ok: true }`\n

## Contest chat
- `GET /api/contests/{contestId}/chat`\n
  - query: `limit?`, `offset?`\n
  - resp: `{ items: ChatMessage[], total: number }`\n
- `GET /api/contests/{contestId}/chat/ws` (WS)\n
  - auth: `Authorization: Bearer ...` или `?accessToken=...`\n

## Типы (сокращенно)
`Contest`: `{ id, created_by_user_id, title, description, status, created_at, updated_at, total_votes }`\n
`Participant`: `{ id, contest_id, user_id, pet_name, pet_description, created_at, updated_at, total_votes }`\n
`Comment`: `{ id, participant_id, user_id, text, created_at, updated_at }`\n
`ChatMessage`: `{ id, contest_id, user_id, text, is_system, created_at, updated_at }`\n

