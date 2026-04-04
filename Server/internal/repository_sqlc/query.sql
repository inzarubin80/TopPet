-- Users

-- name: CreateUser :one
INSERT INTO users (name, email)
VALUES (
    @name,
    NULLIF(btrim(@email::text), '')
)
RETURNING user_id, name, created_at, email, role;

-- name: SetUserEmailIfEmpty :exec
UPDATE users AS u SET email = $2
WHERE u.user_id = $1
  AND (u.email IS NULL OR btrim(COALESCE(u.email, '')) = '')
  AND NOT EXISTS (
    SELECT 1 FROM users u2
    WHERE u2.email = $2 AND u2.user_id <> u.user_id
  );

-- name: GetUserByID :one
SELECT user_id, name, created_at, email, role FROM users
WHERE user_id = $1;

-- name: GetUserRole :one
SELECT role FROM users WHERE user_id = $1;

-- name: ListUsersForAdmin :many
SELECT user_id, name, email, created_at, role
FROM users
ORDER BY user_id ASC
LIMIT $1 OFFSET $2;

-- name: CountUsers :one
SELECT count(*)::bigint AS count FROM users;

-- name: CountSystemAdmins :one
SELECT count(*)::bigint AS count FROM users WHERE role = 'system_admin';

-- name: UpdateUserRole :one
UPDATE users
SET role = $2
WHERE user_id = $1
RETURNING user_id, name, created_at, email, role;

-- name: SearchUsersByQuery :many
SELECT user_id, name, email
FROM users
WHERE (
    $1::text = '' OR
    name ILIKE '%' || $1 || '%' OR
    COALESCE(email, '') ILIKE '%' || $1 || '%'
)
ORDER BY user_id ASC
LIMIT $2;

-- name: UpdateUserName :one
UPDATE users
SET name = $2
WHERE user_id = $1
RETURNING user_id, name, created_at, email, role;

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
SET
  title = $2,
  description = $3,
  public_voting_enabled = $4,
  jury_voting_enabled = $5,
  cover_url = $6,
  tagline = $7,
  rules_url = $8,
  prize_text = $9,
  logo_url = $10,
  theme_color = $11,
  sponsor_name = $12,
  sponsor_logo_url = $13,
  sponsor_url = $14,
  cta_label_override = $15,
  registration_starts_at = $16,
  voting_starts_at = $17,
  voting_ends_at = $18,
  participant_allowed_email_domains = $19,
  schedule_timezone = $20,
  updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ListContestsForStatusAutomation :many
SELECT * FROM contests
WHERE status IN ('draft', 'registration', 'voting')
ORDER BY id;

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
INSERT INTO contest_participants (id, contest_id, user_id, pet_name, pet_description, registration_answers, nomination_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, contest_id, user_id, pet_name, pet_description, created_at, updated_at, registration_answers, nomination_id, submission_status, submission_comment;

-- name: GetParticipantByID :one
SELECT
    cp.id,
    cp.contest_id,
    cp.user_id,
    COALESCE(u.name, 'Пользователь ' || cp.user_id::text) AS user_name,
    cp.pet_name,
    cp.pet_description,
    cp.registration_answers,
    cp.nomination_id,
    cp.submission_status,
    cp.submission_comment,
    cp.created_at,
    cp.updated_at
FROM contest_participants cp
LEFT JOIN users u ON u.user_id = cp.user_id
WHERE cp.id = $1;

-- name: GetParticipantByContestUserAndNomination :one
SELECT
    cp.id,
    cp.contest_id,
    cp.user_id,
    COALESCE(u.name, 'Пользователь ' || cp.user_id::text) AS user_name,
    cp.pet_name,
    cp.pet_description,
    cp.registration_answers,
    cp.nomination_id,
    cp.submission_status,
    cp.submission_comment,
    cp.created_at,
    cp.updated_at
FROM contest_participants cp
LEFT JOIN users u ON u.user_id = cp.user_id
WHERE cp.contest_id = @contest_id AND cp.user_id = @user_id
  AND cp.nomination_id IS NOT DISTINCT FROM @nomination_id::uuid;

-- name: CountParticipantsByContest :one
SELECT COUNT(*)::bigint
FROM contest_participants cp
WHERE cp.contest_id = @contest_id
  AND (
    cp.submission_status = 'accepted'
    OR @include_all::boolean = true
    OR (
      sqlc.narg('viewer_user_id')::bigint IS NOT NULL
      AND cp.user_id = sqlc.narg('viewer_user_id')::bigint
    )
  )
  AND (
    @nomination_filter_mode::text = 'all'
    OR (@nomination_filter_mode::text = 'none' AND cp.nomination_id IS NULL)
    OR (
      @nomination_filter_mode::text = 'id'
      AND cp.nomination_id = @nomination_filter_id::uuid
    )
  )
  AND (
    NOT @jury_unscored_only::boolean
    OR sqlc.narg('viewer_user_id')::bigint IS NULL
    OR (
      (SELECT COUNT(*)::int FROM contest_jury_criteria cjc WHERE cjc.contest_id = cp.contest_id) = 0
    )
    OR (
      (SELECT COUNT(*)::int FROM contest_jury_scores j
       WHERE j.participant_id = cp.id AND j.user_id = sqlc.narg('viewer_user_id')::bigint
      ) < (
      SELECT COUNT(*)::int FROM contest_jury_criteria cjc2 WHERE cjc2.contest_id = cp.contest_id
      )
    )
  )
  AND (
    @participant_scope::text = 'all'
    OR (
      sqlc.narg('viewer_user_id')::bigint IS NOT NULL
      AND cp.user_id = sqlc.narg('viewer_user_id')::bigint
    )
  )
  AND (
    @submission_filter::text = 'all'
    OR (@submission_filter::text = 'accepted' AND cp.submission_status = 'accepted')
    OR (@submission_filter::text = 'pending' AND cp.submission_status = 'pending')
    OR (@submission_filter::text = 'rejected' AND cp.submission_status = 'rejected')
    OR (
      @submission_filter::text = 'non_accepted'
      AND cp.submission_status IN ('pending', 'rejected')
    )
  )
  AND (
    NOT @voted_by_viewer_only::boolean
    OR EXISTS (
      SELECT 1 FROM contest_votes v
      WHERE v.contest_id = cp.contest_id
        AND v.participant_id = cp.id
        AND v.user_id = sqlc.narg('viewer_user_id')::bigint
    )
  );

-- name: ListParticipantsByContest :many
SELECT
    cp.id,
    cp.contest_id,
    cp.user_id,
    COALESCE(u.name, 'Пользователь ' || cp.user_id::text) AS user_name,
    cp.pet_name,
    cp.pet_description,
    cp.registration_answers,
    cp.nomination_id,
    cp.submission_status,
    cp.submission_comment,
    cp.created_at,
    cp.updated_at
FROM contest_participants cp
LEFT JOIN users u ON u.user_id = cp.user_id
LEFT JOIN (
    SELECT participant_id, COUNT(*)::bigint AS vote_cnt
    FROM contest_votes
    GROUP BY participant_id
) vc ON vc.participant_id = cp.id
WHERE cp.contest_id = @contest_id
  AND (
    cp.submission_status = 'accepted'
    OR @include_all::boolean = true
    OR (
      sqlc.narg('viewer_user_id')::bigint IS NOT NULL
      AND cp.user_id = sqlc.narg('viewer_user_id')::bigint
    )
  )
  AND (
    @nomination_filter_mode::text = 'all'
    OR (@nomination_filter_mode::text = 'none' AND cp.nomination_id IS NULL)
    OR (
      @nomination_filter_mode::text = 'id'
      AND cp.nomination_id = @nomination_filter_id::uuid
    )
  )
  AND (
    NOT @jury_unscored_only::boolean
    OR sqlc.narg('viewer_user_id')::bigint IS NULL
    OR (
      (SELECT COUNT(*)::int FROM contest_jury_criteria cjc WHERE cjc.contest_id = cp.contest_id) = 0
    )
    OR (
      (SELECT COUNT(*)::int FROM contest_jury_scores j
       WHERE j.participant_id = cp.id AND j.user_id = sqlc.narg('viewer_user_id')::bigint
      ) < (
      SELECT COUNT(*)::int FROM contest_jury_criteria cjc2 WHERE cjc2.contest_id = cp.contest_id
      )
    )
  )
  AND (
    @participant_scope::text = 'all'
    OR (
      sqlc.narg('viewer_user_id')::bigint IS NOT NULL
      AND cp.user_id = sqlc.narg('viewer_user_id')::bigint
    )
  )
  AND (
    @submission_filter::text = 'all'
    OR (@submission_filter::text = 'accepted' AND cp.submission_status = 'accepted')
    OR (@submission_filter::text = 'pending' AND cp.submission_status = 'pending')
    OR (@submission_filter::text = 'rejected' AND cp.submission_status = 'rejected')
    OR (
      @submission_filter::text = 'non_accepted'
      AND cp.submission_status IN ('pending', 'rejected')
    )
  )
  AND (
    NOT @voted_by_viewer_only::boolean
    OR EXISTS (
      SELECT 1 FROM contest_votes v
      WHERE v.contest_id = cp.contest_id
        AND v.participant_id = cp.id
        AND v.user_id = sqlc.narg('viewer_user_id')::bigint
    )
  )
ORDER BY
  CASE WHEN @order_by_votes::boolean THEN COALESCE(vc.vote_cnt, 0::bigint) ELSE 0::bigint END DESC,
  cp.created_at ASC
LIMIT @list_limit::int OFFSET @list_offset::int;

-- name: UpdateParticipant :one
UPDATE contest_participants
SET pet_name = $2, pet_description = $3, registration_answers = $4, submission_status = 'pending', submission_comment = NULL, updated_at = NOW()
WHERE id = $1
RETURNING id, contest_id, user_id, pet_name, pet_description, created_at, updated_at, registration_answers, nomination_id, submission_status, submission_comment;

-- name: MarkParticipantSubmissionPending :exec
UPDATE contest_participants
SET submission_status = 'pending', submission_comment = NULL, updated_at = NOW()
WHERE id = $1;

-- name: SetParticipantSubmissionStatus :one
UPDATE contest_participants
SET
    submission_status = $2,
    submission_comment = CASE
        WHEN $2 = 'accepted' THEN NULL
        ELSE NULLIF(btrim($3::text), '')
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, contest_id, user_id, pet_name, pet_description, created_at, updated_at, registration_answers, nomination_id, submission_status, submission_comment;

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
INSERT INTO contest_votes (id, contest_id, participant_id, user_id, nomination_id)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (contest_id, user_id, nomination_slot) DO UPDATE
SET participant_id = EXCLUDED.participant_id, nomination_id = EXCLUDED.nomination_id, updated_at = NOW()
RETURNING *;

-- name: GetContestVoteForUserNominationSlot :one
SELECT * FROM contest_votes
WHERE contest_id = @contest_id AND user_id = @user_id
  AND nomination_id IS NOT DISTINCT FROM sqlc.narg('nomination_id')::uuid;

-- name: ListContestVotesByUser :many
SELECT * FROM contest_votes
WHERE contest_id = $1 AND user_id = $2
ORDER BY nomination_slot ASC;

-- name: DeleteContestVoteByUserAndNomination :one
DELETE FROM contest_votes
WHERE contest_id = @contest_id AND user_id = @user_id
  AND nomination_id IS NOT DISTINCT FROM sqlc.narg('nomination_id')::uuid
RETURNING participant_id;

-- name: ListAcceptedParticipantScoresForContest :many
SELECT
    cp.id AS participant_id,
    cp.nomination_id,
    COALESCE(vc.vote_cnt, 0)::bigint AS vote_cnt,
    COALESCE(js.jury_sum, 0)::bigint AS jury_sum
FROM contest_participants cp
LEFT JOIN (
    SELECT participant_id, COUNT(*)::bigint AS vote_cnt
    FROM contest_votes
    GROUP BY participant_id
) vc ON vc.participant_id = cp.id
LEFT JOIN (
    SELECT participant_id, SUM(score)::bigint AS jury_sum
    FROM contest_jury_scores
    GROUP BY participant_id
) js ON js.participant_id = cp.id
WHERE cp.contest_id = $1 AND cp.submission_status = 'accepted';

-- name: CountVotesByContest :one
SELECT count(1) FROM contest_votes
WHERE contest_id = $1;

-- name: CountVotesByParticipant :one
SELECT count(1) FROM contest_votes
WHERE participant_id = $1;

-- name: ListVotersByParticipant :many
SELECT
    cv.user_id,
    COALESCE(u.name, 'Пользователь ' || cv.user_id::text) AS user_name,
    cv.created_at
FROM contest_votes cv
LEFT JOIN users u ON u.user_id = cv.user_id
WHERE cv.contest_id = $1 AND cv.participant_id = $2
ORDER BY cv.created_at ASC;

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

-- name: UpdateParticipantOwnerStaffCommentReadAt :exec
UPDATE contest_participants
SET owner_last_read_staff_comment_at = NOW(), updated_at = NOW()
WHERE id = $1 AND user_id = $2;

-- name: ListStaffCommentNotificationsForUser :many
SELECT
    cp.id AS participant_id,
    cp.contest_id,
    c.title AS contest_title,
    cp.pet_name,
    COUNT(cc.id)::bigint AS unread_count,
    MAX(cc.created_at)::timestamptz AS latest_comment_at,
    (
        SELECT LEFT(cc3.text, 220)
        FROM contest_comments cc3
        INNER JOIN users u3 ON u3.user_id = cc3.user_id
        WHERE cc3.participant_id = cp.id
          AND cc3.user_id <> cp.user_id
          AND (
              c.created_by_user_id = cc3.user_id
              OR u3.role IN ('contest_admin', 'system_admin')
          )
          AND cc3.created_at > COALESCE(cp.owner_last_read_staff_comment_at, '-infinity'::timestamptz)
        ORDER BY cc3.created_at DESC
        LIMIT 1
    ) AS latest_comment_preview
FROM contest_participants cp
INNER JOIN contests c ON c.id = cp.contest_id
INNER JOIN contest_comments cc ON cc.participant_id = cp.id
INNER JOIN users u ON u.user_id = cc.user_id
WHERE cp.user_id = $1
  AND cc.user_id <> cp.user_id
  AND (
      c.created_by_user_id = cc.user_id
      OR u.role IN ('contest_admin', 'system_admin')
  )
  AND cc.created_at > COALESCE(cp.owner_last_read_staff_comment_at, '-infinity'::timestamptz)
GROUP BY cp.id, cp.contest_id, c.title, c.created_by_user_id, cp.pet_name, cp.user_id, cp.owner_last_read_staff_comment_at
HAVING COUNT(cc.id) > 0
ORDER BY MAX(cc.created_at) DESC;

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

-- Contest nominations (категории; без шкал — шкалы только у критериев конкурса)

-- name: CreateNomination :one
INSERT INTO contest_nominations (id, contest_id, title, description, sort_order, min_photo_count)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetNominationByContest :one
SELECT * FROM contest_nominations
WHERE id = $1 AND contest_id = $2;

-- name: UpdateNomination :one
UPDATE contest_nominations
SET title = $3, description = $4, min_photo_count = $5
WHERE id = $1 AND contest_id = $2
RETURNING *;

-- name: ListNominationsByContest :many
SELECT * FROM contest_nominations
WHERE contest_id = $1
ORDER BY sort_order ASC, created_at ASC;

-- name: DeleteNomination :exec
DELETE FROM contest_nominations WHERE id = $1;

-- name: CountNominationsByContest :one
SELECT count(1) FROM contest_nominations WHERE contest_id = $1;

-- Contest jury criteria (общие для всего конкурса)

-- name: ListJuryCriteriaByContest :many
SELECT * FROM contest_jury_criteria
WHERE contest_id = $1
ORDER BY sort_order ASC, created_at ASC;

-- name: DeleteJuryCriteriaByContest :exec
DELETE FROM contest_jury_criteria WHERE contest_id = $1;

-- name: InsertJuryCriterion :one
INSERT INTO contest_jury_criteria (
    id, contest_id, title, description, scale_min, scale_max, scale_step, sort_order
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- Contest jury members

-- name: ListContestJuryMembersWithNames :many
SELECT
    jm.id,
    jm.contest_id,
    jm.user_id,
    jm.created_at,
    u.name AS user_name
FROM contest_jury_members jm
INNER JOIN users u ON u.user_id = jm.user_id
WHERE jm.contest_id = $1
ORDER BY jm.created_at ASC;

-- name: InsertContestJuryMember :one
INSERT INTO contest_jury_members (id, contest_id, user_id)
VALUES ($1, $2, $3)
RETURNING id, contest_id, user_id, created_at;

-- name: DeleteContestJuryMember :exec
DELETE FROM contest_jury_members
WHERE contest_id = $1 AND user_id = $2;

-- name: CountContestJuryMembers :one
SELECT count(*)::bigint FROM contest_jury_members WHERE contest_id = $1;

-- name: IsContestJuryMember :one
SELECT EXISTS (
    SELECT 1 FROM contest_jury_members jm
    WHERE jm.contest_id = $1 AND jm.user_id = $2
);

-- name: UpsertContestJuryScore :one
INSERT INTO contest_jury_scores (id, participant_id, criterion_id, user_id, score, updated_at)
VALUES ($1, $2, $3, $4, $5, NOW())
ON CONFLICT (participant_id, criterion_id, user_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
RETURNING id, participant_id, criterion_id, user_id, score, created_at, updated_at;

-- name: ListContestJuryScoresByParticipantAndUser :many
SELECT id, participant_id, criterion_id, user_id, score, created_at, updated_at
FROM contest_jury_scores
WHERE participant_id = $1 AND user_id = $2
ORDER BY criterion_id;

-- name: SumJuryScoresByParticipantID :one
SELECT COALESCE(SUM(score), 0)::bigint
FROM contest_jury_scores
WHERE participant_id = $1;

-- name: SumJuryScoresByParticipantIDs :many
SELECT participant_id, COALESCE(SUM(score), 0)::bigint AS total_score
FROM contest_jury_scores
WHERE participant_id = ANY($1::uuid[])
GROUP BY participant_id;

-- Contest registration fields (поля заявки участника)

-- name: ListRegistrationFieldsByContest :many
SELECT id, contest_id, sort_order, label, field_type, required, enum_options, created_at
FROM contest_registration_fields
WHERE contest_id = $1
ORDER BY sort_order ASC, created_at ASC;

-- name: DeleteRegistrationFieldsByContest :exec
DELETE FROM contest_registration_fields WHERE contest_id = $1;

-- name: InsertRegistrationField :one
INSERT INTO contest_registration_fields (
    id, contest_id, sort_order, label, field_type, required, enum_options
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, contest_id, sort_order, label, field_type, required, enum_options, created_at;
