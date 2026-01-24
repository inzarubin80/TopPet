-- Users

-- name: CreateUser :one
INSERT INTO users (name)
VALUES ($1)
RETURNING user_id, name, created_at;

-- name: GetUserByID :one
SELECT user_id, name, created_at FROM users
WHERE user_id = $1;

-- name: UpdateUserName :one
UPDATE users
SET name = $2
WHERE user_id = $1
RETURNING user_id, name, created_at;

-- name: GetUserAuthProvidersByProviderUid :one
SELECT user_id, provider_uid, provider, name FROM user_auth_providers
WHERE provider_uid = $1 AND provider = $2;

-- name: AddUserAuthProviders :one
INSERT INTO user_auth_providers (user_id, provider_uid, provider, name)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUserAuthProvidersByUserID :many
SELECT * FROM user_auth_providers
WHERE user_id = $1;

-- Contests

-- name: CreateContest :one
INSERT INTO contests (id, created_by_user_id, title, description, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetContestByID :one
SELECT * FROM contests WHERE id = $1;

-- name: ListContests :many
SELECT * FROM contests
WHERE (COALESCE($1::text, '') = '' OR status = $1)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountContests :one
SELECT count(1) FROM contests
WHERE (COALESCE($1::text, '') = '' OR status = $1);

-- name: UpdateContest :one
UPDATE contests
SET title = $2, description = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateContestStatus :one
UPDATE contests
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteContest :exec
DELETE FROM contests
WHERE id = $1;

-- Contest Participants

-- name: CreateParticipant :one
INSERT INTO contest_participants (id, contest_id, user_id, pet_name, pet_description)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetParticipantByID :one
SELECT
    cp.id,
    cp.contest_id,
    cp.user_id,
    COALESCE(u.name, 'Пользователь ' || cp.user_id::text) AS user_name,
    cp.pet_name,
    cp.pet_description,
    cp.created_at,
    cp.updated_at
FROM contest_participants cp
LEFT JOIN users u ON u.user_id = cp.user_id
WHERE cp.id = $1;

-- name: GetParticipantByContestAndUser :one
SELECT
    cp.id,
    cp.contest_id,
    cp.user_id,
    COALESCE(u.name, 'Пользователь ' || cp.user_id::text) AS user_name,
    cp.pet_name,
    cp.pet_description,
    cp.created_at,
    cp.updated_at
FROM contest_participants cp
LEFT JOIN users u ON u.user_id = cp.user_id
WHERE cp.contest_id = $1 AND cp.user_id = $2;

-- name: ListParticipantsByContest :many
SELECT
    cp.id,
    cp.contest_id,
    cp.user_id,
    COALESCE(u.name, 'Пользователь ' || cp.user_id::text) AS user_name,
    cp.pet_name,
    cp.pet_description,
    cp.created_at,
    cp.updated_at
FROM contest_participants cp
LEFT JOIN users u ON u.user_id = cp.user_id
WHERE cp.contest_id = $1
ORDER BY cp.created_at ASC;

-- name: UpdateParticipant :one
UPDATE contest_participants
SET pet_name = $2, pet_description = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteParticipant :exec
DELETE FROM contest_participants
WHERE id = $1;

-- Contest Participant Photos

-- name: AddParticipantPhoto :one
INSERT INTO contest_participant_photos (id, participant_id, url, thumb_url, position)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetPhotosByParticipantID :many
SELECT * FROM contest_participant_photos
WHERE participant_id = $1
ORDER BY position ASC, created_at ASC;

-- name: GetMaxPhotoPositionByParticipant :one
SELECT COALESCE(MAX(position), 0) AS max_position
FROM contest_participant_photos
WHERE participant_id = $1;

-- name: UpdateParticipantPhotoOrder :exec
UPDATE contest_participant_photos
SET position = $3
WHERE participant_id = $1 AND id = $2;

-- name: DeleteParticipantPhoto :exec
DELETE FROM contest_participant_photos
WHERE id = $1;

-- Contest Participant Videos

-- name: UpsertParticipantVideo :one
INSERT INTO contest_participant_videos (id, participant_id, url)
VALUES ($1, $2, $3)
ON CONFLICT (participant_id) DO UPDATE
SET id = EXCLUDED.id, url = EXCLUDED.url, created_at = NOW()
RETURNING *;

-- name: GetVideoByParticipantID :one
SELECT * FROM contest_participant_videos
WHERE participant_id = $1;

-- name: DeleteParticipantVideo :exec
DELETE FROM contest_participant_videos
WHERE participant_id = $1;

-- Contest Votes

-- name: UpsertContestVote :one
INSERT INTO contest_votes (id, contest_id, participant_id, user_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (contest_id, user_id) DO UPDATE
SET participant_id = EXCLUDED.participant_id, updated_at = NOW()
RETURNING *;

-- name: GetContestVoteByUser :one
SELECT * FROM contest_votes
WHERE contest_id = $1 AND user_id = $2;

-- name: DeleteContestVoteByUser :one
DELETE FROM contest_votes
WHERE contest_id = $1 AND user_id = $2
RETURNING participant_id;

-- name: CountVotesByContest :one
SELECT count(1) FROM contest_votes
WHERE contest_id = $1;

-- name: CountVotesByParticipant :one
SELECT count(1) FROM contest_votes
WHERE participant_id = $1;

-- name: CountVotesByContests :many
SELECT contest_id, count(1) as vote_count FROM contest_votes
WHERE contest_id = ANY($1::uuid[])
GROUP BY contest_id;

-- Contest Comments

-- name: CreateComment :one
INSERT INTO contest_comments (id, participant_id, user_id, text)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetCommentByID :one
SELECT * FROM contest_comments WHERE id = $1;

-- name: ListCommentsByParticipant :many
SELECT
    cc.id,
    cc.participant_id,
    cc.user_id,
    cc.text,
    cc.created_at,
    cc.updated_at,
    COALESCE(u.name, 'Пользователь ' || cc.user_id::text) AS user_name
FROM contest_comments cc
LEFT JOIN users u ON u.user_id = cc.user_id
WHERE cc.participant_id = $1
ORDER BY cc.created_at ASC
LIMIT $2 OFFSET $3;

-- name: CountCommentsByParticipant :one
SELECT count(1) FROM contest_comments
WHERE participant_id = $1;

-- name: UpdateComment :one
UPDATE contest_comments
SET text = $1, updated_at = NOW()
WHERE id = $2 AND user_id = $3
RETURNING *;

-- name: DeleteComment :exec
DELETE FROM contest_comments
WHERE id = $1;

-- name: DeleteCommentsByParticipant :exec
DELETE FROM contest_comments
WHERE participant_id = $1;

-- name: DeleteVotesByParticipant :exec
DELETE FROM contest_votes
WHERE participant_id = $1;

-- Contest Chat Messages

-- name: CreateChatMessage :one
INSERT INTO contest_chat_messages (id, contest_id, user_id, text, is_system)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListChatMessages :many
SELECT 
    ccm.id,
    ccm.contest_id,
    ccm.user_id,
    ccm.text,
    ccm.is_system,
    ccm.created_at,
    ccm.updated_at,
    COALESCE(u.name, 'Пользователь ' || ccm.user_id::text) as user_name
FROM contest_chat_messages ccm
LEFT JOIN users u ON u.user_id = ccm.user_id
WHERE ccm.contest_id = $1
ORDER BY ccm.created_at ASC
LIMIT $2 OFFSET $3;

-- name: CountChatMessages :one
SELECT count(1) FROM contest_chat_messages
WHERE contest_id = $1;

-- name: UpdateChatMessage :one
UPDATE contest_chat_messages
SET text = $1, updated_at = NOW()
WHERE id = $2 AND user_id = $3 AND is_system = FALSE
RETURNING *;

-- name: DeleteChatMessage :one
DELETE FROM contest_chat_messages
WHERE id = $1 AND user_id = $2 AND is_system = FALSE
RETURNING contest_id;

-- Photo Likes

-- name: UpsertPhotoLike :one
INSERT INTO photo_likes (id, photo_id, user_id)
VALUES ($1, $2, $3)
ON CONFLICT (photo_id, user_id) DO UPDATE
SET id = photo_likes.id
RETURNING *;

-- name: DeletePhotoLike :exec
DELETE FROM photo_likes
WHERE photo_id = $1 AND user_id = $2;

-- name: GetPhotoLikeByUser :one
SELECT * FROM photo_likes
WHERE photo_id = $1 AND user_id = $2;

-- name: CountPhotoLikes :one
SELECT count(1) FROM photo_likes
WHERE photo_id = $1;

-- name: ListPhotoLikesByPhotos :many
SELECT id, photo_id, user_id, created_at
FROM photo_likes
WHERE photo_id = ANY($1::uuid[]) AND user_id = $2;
