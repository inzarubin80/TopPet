-- Users

-- name: CreateUser :one
INSERT INTO users (name, email)
VALUES (
    @name,
    NULLIF(btrim(@email::text), '')
)
RETURNING user_id, name, created_at, email, role, is_blocked, date_of_birth, phone, avatar_url;

-- name: SetUserEmailIfEmpty :exec
UPDATE users AS u SET email = $2
WHERE u.user_id = $1
  AND (u.email IS NULL OR btrim(COALESCE(u.email, '')) = '')
  AND NOT EXISTS (
    SELECT 1 FROM users u2
    WHERE u2.email = $2 AND u2.user_id <> u.user_id
  );

-- name: GetUserByID :one
SELECT user_id, name, created_at, email, role, is_blocked, date_of_birth, phone, avatar_url FROM users
WHERE user_id = $1;

-- name: IsUserBlocked :one
SELECT is_blocked FROM users WHERE user_id = $1;

-- name: GetUserRole :one
SELECT role FROM users WHERE user_id = $1;

-- name: ListUsersForAdmin :many
SELECT
  u.user_id,
  u.name,
  u.email,
  u.created_at,
  u.role,
  u.is_blocked,
  u.date_of_birth,
  u.phone,
  u.avatar_url,
  COALESCE((
    SELECT string_agg(DISTINCT p.provider, ', ' ORDER BY p.provider)
    FROM user_auth_providers p
    WHERE p.user_id = u.user_id
  ), '') AS auth_providers
FROM users u
ORDER BY u.user_id ASC
LIMIT $1 OFFSET $2;

-- name: CountUsers :one
SELECT count(*)::bigint AS count FROM users;

-- name: CountSystemAdmins :one
SELECT count(*)::bigint AS count FROM users WHERE role = 'system_admin';

-- name: UpdateUserRole :one
UPDATE users
SET role = $2
WHERE user_id = $1
RETURNING user_id, name, created_at, email, role, is_blocked, date_of_birth, phone, avatar_url;

-- name: UpdateUserBlocked :one
UPDATE users
SET is_blocked = $2
WHERE user_id = $1
RETURNING user_id, name, created_at, email, role, is_blocked, date_of_birth, phone, avatar_url;

-- name: SearchUsersByQuery :many
SELECT user_id, name, email
FROM users
WHERE (
    $1::text = '' OR
    name ILIKE '%' || $1 || '%' OR
    COALESCE(email, '') ILIKE '%' || $1 || '%' OR
    COALESCE(phone, '') ILIKE '%' || $1 || '%'
)
ORDER BY user_id ASC
LIMIT $2;

-- name: UpdateUserName :one
UPDATE users
SET name = $2
WHERE user_id = $1
RETURNING user_id, name, created_at, email, role, is_blocked, date_of_birth, phone, avatar_url;

-- name: UpdateUserProfile :one
UPDATE users SET
  name = @name,
  email = NULLIF(btrim(@email::text), ''),
  phone = NULLIF(btrim(@phone::text), ''),
  date_of_birth = @date_of_birth,
  avatar_url = NULLIF(btrim(@avatar_url::text), '')
WHERE user_id = @user_id
RETURNING user_id, name, created_at, email, role, is_blocked, date_of_birth, phone, avatar_url;

-- name: SetUserAvatarIfEmpty :exec
UPDATE users SET avatar_url = $2
WHERE user_id = $1
  AND (avatar_url IS NULL OR btrim(COALESCE(avatar_url, '')) = '');

-- name: SetUserPhoneIfEmpty :exec
UPDATE users SET phone = $2
WHERE user_id = $1
  AND (phone IS NULL OR btrim(COALESCE(phone, '')) = '');

-- name: SetUserDateOfBirthIfEmpty :exec
UPDATE users SET date_of_birth = $2
WHERE user_id = $1
  AND date_of_birth IS NULL;

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

-- name: DeleteUserAuthProvidersByUserID :exec
DELETE FROM user_auth_providers WHERE user_id = $1;

-- name: DeleteUser :exec
DELETE FROM users WHERE user_id = $1;

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
  rules_text = $8,
  prize_text = $9,
  jury_prize_places = $10,
  audience_prize_places = $11,
  logo_url = $12,
  theme_color = $13,
  sponsor_name = $14,
  sponsor_logo_url = $15,
  sponsor_url = $16,
  cta_label_override = $17,
  publication_starts_at = $18,
  registration_starts_at = $19,
  voting_starts_at = $20,
  voting_ends_at = $21,
  participant_allowed_email_domains = $22,
  schedule_timezone = $23,
  min_photo_count = $24,
  max_photo_count = $25,
  entry_title_hint = $26,
  updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SyncNominationPhotoCountsByContest :exec
UPDATE contest_nominations
SET min_photo_count = $2, max_photo_count = $3
WHERE contest_id = $1;

-- name: ListContestsForStatusAutomation :many
SELECT * FROM contests
WHERE status IN ('draft', 'publication', 'registration', 'voting', 'finished')
ORDER BY id;

-- name: UpdateContestStatus :one
UPDATE contests
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateContestVotingResults :one
UPDATE contests
SET
  audience_winners_snapshot = $2,
  jury_winners_snapshot = $3,
  voting_results_computed_at = NOW(),
  updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteContest :exec
DELETE FROM contests
WHERE id = $1;

-- Contest Participants

-- name: CreateParticipant :one
INSERT INTO contest_participants (id, contest_id, user_id, pet_name, pet_description, entry_title, entry_description, author_name, registration_answers, nomination_id)
VALUES ($1, $2, $3, $4, $5, $4, $5, $6, $7, $8)
RETURNING id, contest_id, user_id, pet_name, pet_description, entry_title, entry_description, author_name, created_at, updated_at, registration_answers, nomination_id, submission_status, submission_comment;

-- name: InsertParticipantConsentAudit :exec
INSERT INTO participant_consent_audits (
    participant_id,
    user_id,
    consent_type,
    policy_version,
    ip_address,
    user_agent
)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: GetParticipantByID :one
SELECT
    cp.id,
    cp.contest_id,
    cp.user_id,
    COALESCE(u.name, 'Пользователь ' || cp.user_id::text) AS user_name,
    cp.pet_name,
    cp.pet_description,
    cp.entry_title,
    cp.entry_description,
    cp.author_name,
    cp.registration_answers,
    cp.nomination_id,
    cp.submission_status,
    cp.submission_comment,
    (
      SELECT COUNT(*)::bigint
      FROM contest_comments cc
      WHERE cc.participant_id = cp.id
    ) AS comment_count,
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
    cp.entry_title,
    cp.entry_description,
    cp.author_name,
    cp.registration_answers,
    cp.nomination_id,
    cp.submission_status,
    cp.submission_comment,
    (
      SELECT COUNT(*)::bigint
      FROM contest_comments cc
      WHERE cc.participant_id = cp.id
    ) AS comment_count,
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
  )
  AND (
    NOT @favorite_only::boolean
    OR (
      sqlc.narg('viewer_user_id')::bigint IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM contest_user_participant_favorites f
        WHERE f.participant_id = cp.id
          AND f.user_id = sqlc.narg('viewer_user_id')::bigint
      )
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
    cp.entry_title,
    cp.entry_description,
    cp.author_name,
    cp.registration_answers,
    cp.nomination_id,
    cp.submission_status,
    cp.submission_comment,
    COALESCE(cc.comment_cnt, 0)::bigint AS comment_count,
    cp.created_at,
    cp.updated_at
FROM contest_participants cp
LEFT JOIN users u ON u.user_id = cp.user_id
LEFT JOIN (
    SELECT participant_id, COUNT(*)::bigint AS vote_cnt
    FROM contest_votes
    GROUP BY participant_id
) vc ON vc.participant_id = cp.id
LEFT JOIN (
    SELECT participant_id, COALESCE(SUM(score), 0)::bigint AS jury_sum
    FROM contest_jury_scores
    GROUP BY participant_id
) js ON js.participant_id = cp.id
LEFT JOIN (
    SELECT participant_id, COUNT(*)::bigint AS comment_cnt
    FROM contest_comments
    GROUP BY participant_id
) cc ON cc.participant_id = cp.id
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
  AND (
    NOT @favorite_only::boolean
    OR (
      sqlc.narg('viewer_user_id')::bigint IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM contest_user_participant_favorites f
        WHERE f.participant_id = cp.id
          AND f.user_id = sqlc.narg('viewer_user_id')::bigint
      )
    )
  )
ORDER BY
  CASE WHEN @list_order::text = 'votes' THEN COALESCE(vc.vote_cnt, 0::bigint) END DESC NULLS LAST,
  CASE WHEN @list_order::text = 'jury' THEN COALESCE(js.jury_sum, 0::bigint) END DESC NULLS LAST,
  CASE WHEN @list_order::text = 'comments' THEN COALESCE(cc.comment_cnt, 0::bigint) END DESC NULLS LAST,
  CASE WHEN @list_order::text = 'created_at' THEN cp.created_at END DESC NULLS LAST,
  cp.id ASC
LIMIT @list_limit::int OFFSET @list_offset::int;

-- name: UpdateParticipant :one
UPDATE contest_participants
SET pet_name = $2, pet_description = $3, entry_title = $2, entry_description = $3, author_name = $4, registration_answers = $5, nomination_id = $6, submission_status = 'pending', updated_at = NOW()
WHERE id = $1
RETURNING id, contest_id, user_id, pet_name, pet_description, entry_title, entry_description, author_name, created_at, updated_at, registration_answers, nomination_id, submission_status, submission_comment;

-- name: MarkParticipantSubmissionPending :exec
UPDATE contest_participants
SET submission_status = 'pending', updated_at = NOW()
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
RETURNING id, contest_id, user_id, pet_name, pet_description, entry_title, entry_description, author_name, created_at, updated_at, registration_answers, nomination_id, submission_status, submission_comment;

-- name: UpsertParticipantFavorite :exec
INSERT INTO contest_user_participant_favorites (user_id, participant_id)
VALUES ($1, $2)
ON CONFLICT (user_id, participant_id) DO NOTHING;

-- name: DeleteParticipantFavorite :exec
DELETE FROM contest_user_participant_favorites
WHERE user_id = $1 AND participant_id = $2;

-- name: IsParticipantFavorite :one
SELECT EXISTS (
  SELECT 1 FROM contest_user_participant_favorites
  WHERE user_id = $1 AND participant_id = $2
);

-- name: DeleteParticipantFavoritesByParticipantID :exec
DELETE FROM contest_user_participant_favorites WHERE participant_id = $1;

-- name: DeleteParticipant :exec
DELETE FROM contest_participants
WHERE id = $1;

-- name: ListParticipantIDsByUserID :many
SELECT id FROM contest_participants WHERE user_id = $1;

-- name: DeleteParticipantConsentAuditsForUser :exec
DELETE FROM participant_consent_audits AS pca
WHERE pca.user_id = $1
   OR pca.participant_id IN (SELECT cp.id FROM contest_participants cp WHERE cp.user_id = $1);

-- name: DeleteContestVotesByUserID :exec
DELETE FROM contest_votes WHERE user_id = $1;

-- name: DeleteContestCommentsByUserID :exec
DELETE FROM contest_comments WHERE user_id = $1;

-- name: DeleteContestJuryMembersByUserID :exec
DELETE FROM contest_jury_members WHERE user_id = $1;

-- name: DeletePaymentsByUserID :exec
DELETE FROM payments WHERE user_id = $1;

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

-- Contest Votes

-- name: UpsertContestVote :one
INSERT INTO contest_votes (id, contest_id, participant_id, user_id, nomination_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListContestVotesByUser :many
SELECT * FROM contest_votes
WHERE contest_id = $1 AND user_id = $2
ORDER BY created_at ASC;

-- name: DeleteContestVoteByUserAndParticipant :one
DELETE FROM contest_votes
WHERE contest_id = @contest_id AND user_id = @user_id AND participant_id = @participant_id
RETURNING participant_id;

-- name: ListAcceptedParticipantScoresForContest :many
SELECT
    cp.id AS participant_id,
    cp.nomination_id,
    cp.pet_name,
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

-- name: ListAcceptedParticipantScoresForContests :many
SELECT
    cp.contest_id,
    cp.id AS participant_id,
    cp.nomination_id,
    cp.pet_name,
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
WHERE cp.contest_id = ANY($1::uuid[]) AND cp.submission_status = 'accepted';

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
INSERT INTO contest_comments (id, participant_id, user_id, text, parent_id, image_url)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetCommentByID :one
SELECT * FROM contest_comments WHERE id = $1;

-- name: ListCommentsByParticipant :many
SELECT
    cc.id,
    cc.participant_id,
    cc.parent_id,
    cc.user_id,
    cc.text,
    cc.image_url,
    cc.created_at,
    cc.updated_at,
    COALESCE(u.name, 'Пользователь ' || cc.user_id::text) AS user_name,
    u.avatar_url AS user_avatar_url,
    COALESCE((SELECT SUM(v.value)::bigint FROM contest_comment_votes v WHERE v.comment_id = cc.id), 0)::bigint AS score,
    COALESCE((SELECT v2.value::int FROM contest_comment_votes v2 WHERE v2.comment_id = cc.id AND v2.user_id = sqlc.narg('viewer_user_id')::bigint), 0)::int AS user_vote,
    (
        c.created_by_user_id = cc.user_id
        OR u.role IN ('contest_admin', 'system_admin')
    ) AS is_staff_comment
FROM contest_comments cc
LEFT JOIN users u ON u.user_id = cc.user_id
INNER JOIN contest_participants cp ON cp.id = cc.participant_id
INNER JOIN contests c ON c.id = cp.contest_id
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

-- name: GetCommentVoteStats :one
SELECT
  cc.id,
  cc.participant_id,
  cp.contest_id,
  COALESCE((SELECT SUM(v.value)::bigint FROM contest_comment_votes v WHERE v.comment_id = cc.id), 0)::bigint AS score
FROM contest_comments cc
INNER JOIN contest_participants cp ON cp.id = cc.participant_id
WHERE cc.id = $1;

-- name: UpsertCommentVote :one
INSERT INTO contest_comment_votes (comment_id, user_id, value)
VALUES ($1, $2, $3)
ON CONFLICT (comment_id, user_id)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
RETURNING comment_id, user_id, value;

-- name: DeleteComment :exec
DELETE FROM contest_comments
WHERE id = $1;

-- name: DeleteContestCommentsSubtree :many
WITH RECURSIVE tree AS (
    SELECT cc.id, cc.participant_id FROM contest_comments cc WHERE cc.id = $1
    UNION ALL
    SELECT cc.id, cc.participant_id
    FROM contest_comments cc
    INNER JOIN tree t ON cc.parent_id = t.id AND cc.participant_id = t.participant_id
),
removed AS (
    DELETE FROM contest_comments AS cdel WHERE cdel.id IN (SELECT t.id FROM tree t) RETURNING cdel.id AS id
)
SELECT id FROM removed;

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
INSERT INTO contest_chat_messages (id, contest_id, user_id, text, is_system, parent_id, image_url)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListChatMessages :many
SELECT 
    ccm.id,
    ccm.contest_id,
    ccm.parent_id,
    ccm.user_id,
    ccm.text,
    ccm.image_url,
    ccm.is_system,
    ccm.created_at,
    ccm.updated_at,
    COALESCE(u.name, 'Пользователь ' || ccm.user_id::text) as user_name,
    u.avatar_url AS user_avatar_url,
    COALESCE((SELECT SUM(v.value)::bigint FROM contest_chat_message_votes v WHERE v.message_id = ccm.id), 0)::bigint AS score,
    COALESCE((SELECT v2.value::int FROM contest_chat_message_votes v2 WHERE v2.message_id = ccm.id AND v2.user_id = sqlc.narg('viewer_user_id')::bigint), 0)::int AS user_vote
FROM contest_chat_messages ccm
LEFT JOIN users u ON u.user_id = ccm.user_id
WHERE ccm.contest_id = $1
ORDER BY ccm.created_at ASC
LIMIT $2 OFFSET $3;

-- name: GetChatMessageByID :one
SELECT * FROM contest_chat_messages
WHERE id = $1;

-- name: GetChatMessageVoteStats :one
SELECT 
  ccm.id,
  ccm.contest_id,
  COALESCE((SELECT SUM(v.value)::bigint FROM contest_chat_message_votes v WHERE v.message_id = ccm.id), 0)::bigint AS score
FROM contest_chat_messages ccm
WHERE ccm.id = $1;

-- name: CountChatMessages :one
SELECT count(1) FROM contest_chat_messages
WHERE contest_id = $1;

-- name: UpdateChatMessage :one
UPDATE contest_chat_messages
SET text = $1, updated_at = NOW()
WHERE id = $2 AND user_id = $3 AND is_system = FALSE
RETURNING *;

-- name: UpsertChatMessageVote :one
INSERT INTO contest_chat_message_votes (message_id, user_id, value)
VALUES ($1, $2, $3)
ON CONFLICT (message_id, user_id)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
RETURNING message_id, user_id, value;

-- name: DeleteChatMessage :one
DELETE FROM contest_chat_messages
WHERE id = $1 AND user_id = $2 AND is_system = FALSE
RETURNING contest_id;

-- name: DeleteContestChatMessagesSubtree :many
WITH RECURSIVE tree AS (
    SELECT m.id, m.contest_id FROM contest_chat_messages m WHERE m.id = $1
    UNION ALL
    SELECT c.id, c.contest_id
    FROM contest_chat_messages c
    INNER JOIN tree t ON c.parent_id = t.id AND c.contest_id = t.contest_id
),
removed AS (
    DELETE FROM contest_chat_messages AS mdel
    WHERE mdel.id IN (SELECT t.id FROM tree t)
    RETURNING mdel.id AS id, mdel.contest_id AS contest_id
)
SELECT id, contest_id FROM removed;

-- name: DeleteChatMessagesByUserID :exec
DELETE FROM contest_chat_messages WHERE user_id = $1;

-- Contest nominations (категории; без шкал — шкалы только у критериев конкурса)

-- name: CreateNomination :one
INSERT INTO contest_nominations (id, contest_id, title, description, sort_order, min_photo_count, max_photo_count)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetNominationByContest :one
SELECT * FROM contest_nominations
WHERE id = $1 AND contest_id = $2;

-- name: UpdateNomination :one
UPDATE contest_nominations
SET title = $3, description = $4, min_photo_count = $5, max_photo_count = $6
WHERE id = $1 AND contest_id = $2
RETURNING *;

-- name: UpdateNominationLogoUrl :one
UPDATE contest_nominations
SET logo_url = $3
WHERE id = $1 AND contest_id = $2
RETURNING *;

-- name: UpdateNominationSortOrder :execrows
UPDATE contest_nominations
SET sort_order = $3
WHERE id = $1 AND contest_id = $2;

-- name: ListNominationsByContest :many
SELECT * FROM contest_nominations
WHERE contest_id = $1
ORDER BY sort_order ASC, created_at ASC;

-- name: ListNominationsForContests :many
SELECT * FROM contest_nominations
WHERE contest_id = ANY($1::uuid[])
ORDER BY contest_id ASC, sort_order ASC, created_at ASC;

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
    id, contest_id, title, description, scale_min, scale_max, scale_step, sort_order, weight
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateJuryCriterion :one
UPDATE contest_jury_criteria
SET
    title = $3,
    description = $4,
    scale_min = $5,
    scale_max = $6,
    scale_step = $7,
    sort_order = $8,
    weight = $9
WHERE id = $1 AND contest_id = $2
RETURNING *;

-- name: DeleteJuryCriterionForContest :exec
DELETE FROM contest_jury_criteria
WHERE id = $1 AND contest_id = $2;

-- Contest jury members

-- name: ListContestJuryMembersWithNames :many
SELECT
    jm.id,
    jm.contest_id,
    jm.user_id,
    jm.created_at,
    jm.sort_order,
    jm.is_chair,
    jm.portfolio_url,
    jm.bio_short,
    u.name AS user_name,
    u.avatar_url AS user_avatar_url
FROM contest_jury_members jm
INNER JOIN users u ON u.user_id = jm.user_id
WHERE jm.contest_id = $1
ORDER BY jm.sort_order ASC, jm.created_at ASC;

-- name: NextContestJurySortOrder :one
SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
FROM contest_jury_members
WHERE contest_id = $1;

-- name: InsertContestJuryMember :one
INSERT INTO contest_jury_members (id, contest_id, user_id, sort_order, is_chair, portfolio_url, bio_short)
VALUES ($1, $2, $3, $4, false, '', '')
RETURNING id, contest_id, user_id, created_at, sort_order, is_chair, portfolio_url, bio_short;

-- name: GetContestJuryMemberWithName :one
SELECT
    jm.id,
    jm.contest_id,
    jm.user_id,
    jm.created_at,
    jm.sort_order,
    jm.is_chair,
    jm.portfolio_url,
    jm.bio_short,
    u.name AS user_name,
    u.avatar_url AS user_avatar_url
FROM contest_jury_members jm
INNER JOIN users u ON u.user_id = jm.user_id
WHERE jm.contest_id = $1 AND jm.user_id = $2;

-- name: UpdateContestJuryMember :one
UPDATE contest_jury_members
SET
    portfolio_url = $3,
    bio_short = $4,
    sort_order = $5,
    is_chair = $6
WHERE contest_id = $1 AND user_id = $2
RETURNING id, contest_id, user_id, created_at, sort_order, is_chair, portfolio_url, bio_short;

-- name: SetContestJuryMemberSortOrder :exec
UPDATE contest_jury_members
SET sort_order = $3
WHERE contest_id = $1 AND user_id = $2;

-- name: DeleteContestJuryMember :exec
DELETE FROM contest_jury_members
WHERE contest_id = $1 AND user_id = $2;

-- name: CountContestJuryMembers :one
SELECT count(*)::bigint FROM contest_jury_members WHERE contest_id = $1;

-- name: CountContestJuryCriteria :one
SELECT COUNT(*)::bigint
FROM contest_jury_criteria
WHERE contest_id = $1;

-- name: CountJuryFullyScoredJurorsByParticipantIDs :many
-- Сколько членов жюри выставили баллы по всем критериям конкурса для каждой заявки.
SELECT
  sub.participant_id,
  COUNT(*)::bigint AS fully_scored_jurors
FROM (
  SELECT
    j.participant_id,
    j.user_id
  FROM contest_jury_scores j
  INNER JOIN contest_participants cp ON cp.id = j.participant_id
  WHERE j.participant_id = ANY($1::uuid[])
  GROUP BY j.participant_id, j.user_id, cp.contest_id
  HAVING COUNT(*)::int = (
    SELECT COUNT(*)::int
    FROM contest_jury_criteria cjc
    WHERE cjc.contest_id = cp.contest_id
  )
) AS sub
GROUP BY sub.participant_id;

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

-- Детальный отчёт по оценкам жюри для заявки (для организаторов конкурса).
-- name: ListContestJuryScoresReportByParticipant :many
SELECT
  j.user_id AS juror_user_id,
  COALESCE(u.name, 'Пользователь ' || j.user_id::text) AS juror_name,
  j.criterion_id,
  c.title AS criterion_title,
  c.sort_order AS criterion_sort_order,
  c.scale_min,
  c.scale_max,
  j.score,
  j.updated_at AS score_updated_at
FROM contest_jury_scores j
INNER JOIN contest_participants cp ON cp.id = j.participant_id
INNER JOIN contest_jury_criteria c ON c.id = j.criterion_id AND c.contest_id = cp.contest_id
LEFT JOIN users u ON u.user_id = j.user_id
WHERE j.participant_id = $1
ORDER BY j.user_id, c.sort_order ASC, c.title ASC;

-- Прогресс оценивания: каждая пара (работа × член жюри) и число выставленных критериев.
-- name: ListContestJuryVotingProgressByContest :many
SELECT
  cp.id AS participant_id,
  cp.pet_name,
  cp.submission_status,
  jm.user_id AS juror_user_id,
  COALESCE(u.name, 'Пользователь ' || jm.user_id::text) AS juror_name,
  (
    SELECT COUNT(DISTINCT j.criterion_id)::int
    FROM contest_jury_scores j
    WHERE j.participant_id = cp.id AND j.user_id = jm.user_id
  ) AS criteria_scored
FROM contest_participants cp
CROSS JOIN contest_jury_members jm
LEFT JOIN users u ON u.user_id = jm.user_id
WHERE cp.contest_id = $1 AND jm.contest_id = $1
  AND cp.submission_status = 'accepted'
ORDER BY cp.created_at ASC, jm.user_id ASC;

-- Свод председателя: взвешенная сумма по каждой паре (заявка × член жюри).
-- name: ListJuryWeightedTotalsByContest :many
SELECT
  cp.id AS participant_id,
  jm.user_id AS juror_user_id,
  COALESCE(SUM(j.score::double precision * c.weight), 0)::double precision AS weighted_total
FROM contest_participants cp
INNER JOIN contest_jury_members jm ON jm.contest_id = cp.contest_id
LEFT JOIN contest_jury_scores j ON j.participant_id = cp.id AND j.user_id = jm.user_id
LEFT JOIN contest_jury_criteria c ON c.id = j.criterion_id AND c.contest_id = cp.contest_id
WHERE cp.contest_id = $1
  AND cp.submission_status = 'accepted'
GROUP BY cp.id, jm.user_id, jm.sort_order
ORDER BY cp.created_at ASC, jm.sort_order ASC, jm.user_id ASC;

-- name: SumJuryScoresByParticipantID :one
SELECT COALESCE(SUM(j.score::double precision * c.weight), 0)::double precision
FROM contest_jury_scores j
INNER JOIN contest_jury_criteria c ON c.id = j.criterion_id
WHERE j.participant_id = $1;

-- name: SumJuryScoresByParticipantIDs :many
SELECT
    j.participant_id,
    COALESCE(SUM(j.score::double precision * c.weight), 0)::double precision AS total_score
FROM contest_jury_scores j
INNER JOIN contest_jury_criteria c ON c.id = j.criterion_id
WHERE j.participant_id = ANY($1::uuid[])
GROUP BY j.participant_id;

-- Contest registration fields (поля заявки участника)

-- name: ListRegistrationFieldsByContest :many
SELECT id, contest_id, sort_order, label, field_type, required, enum_options, help_text, created_at
FROM contest_registration_fields
WHERE contest_id = $1
ORDER BY sort_order ASC, created_at ASC;

-- name: DeleteRegistrationFieldsByContest :exec
DELETE FROM contest_registration_fields WHERE contest_id = $1;

-- name: InsertRegistrationField :one
INSERT INTO contest_registration_fields (
    id, contest_id, sort_order, label, field_type, required, enum_options, help_text
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, contest_id, sort_order, label, field_type, required, enum_options, help_text, created_at;


-- User notifications (per-user, not tied to contest WebSocket room)

-- name: InsertUserNotification :one
INSERT INTO user_notifications (user_id, kind, payload)
VALUES ($1, $2, $3)
RETURNING id, user_id, kind, payload, read_at, created_at;

-- name: CountUnreadUserNotifications :one
SELECT COUNT(*)::bigint AS cnt
FROM user_notifications
WHERE user_id = $1 AND read_at IS NULL;

-- name: ListUserNotificationsForUser :many
SELECT id, user_id, kind, payload, read_at, created_at
FROM user_notifications
WHERE user_id = $1
  AND (
    sqlc.narg('cursor_created_at')::timestamptz IS NULL
    OR (created_at, id) < (sqlc.narg('cursor_created_at')::timestamptz, sqlc.narg('cursor_id')::uuid)
  )
ORDER BY created_at DESC, id DESC
LIMIT $2;

-- name: MarkUserNotificationReadByOwner :one
UPDATE user_notifications
SET read_at = NOW()
WHERE id = $1 AND user_id = $2 AND read_at IS NULL
RETURNING id, user_id, kind, payload, read_at, created_at;

-- name: MarkAllUserNotificationsRead :exec
UPDATE user_notifications
SET read_at = NOW()
WHERE user_id = $1 AND read_at IS NULL;
