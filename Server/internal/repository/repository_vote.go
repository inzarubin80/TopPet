package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func nominationUUIDForVote(nominationID *string) pgtype.UUID {
	if nominationID == nil || strings.TrimSpace(*nominationID) == "" {
		return pgtype.UUID{Valid: false}
	}
	u, err := uuid.Parse(strings.TrimSpace(*nominationID))
	if err != nil {
		return pgtype.UUID{Valid: false}
	}
	return pgtype.UUID{Bytes: u, Valid: true}
}

func voteModelFromSQLc(vote *sqlc_repository.ContestVote) *model.Vote {
	if vote == nil {
		return nil
	}
	var voteIDStr, contestIDStr, participantIDStr string
	if vote.ID.Valid {
		voteIDStr = uuid.UUID(vote.ID.Bytes).String()
	}
	if vote.ContestID.Valid {
		contestIDStr = uuid.UUID(vote.ContestID.Bytes).String()
	}
	if vote.ParticipantID.Valid {
		participantIDStr = uuid.UUID(vote.ParticipantID.Bytes).String()
	}
	var nom *string
	if vote.NominationID.Valid {
		s := uuid.UUID(vote.NominationID.Bytes).String()
		nom = &s
	}
	return &model.Vote{
		ID:            voteIDStr,
		ContestID:     model.ContestID(contestIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		NominationID:  nom,
		UserID:        model.UserID(vote.UserID),
		CreatedAt:     vote.CreatedAt.Time,
		UpdatedAt:     vote.UpdatedAt.Time,
	}
}

func voteModelFromUserSQLc(vote *sqlc_repository.ContestUserVote) *model.Vote {
	if vote == nil {
		return nil
	}
	var voteIDStr, contestIDStr, participantIDStr string
	if vote.ID.Valid {
		voteIDStr = uuid.UUID(vote.ID.Bytes).String()
	}
	if vote.ContestID.Valid {
		contestIDStr = uuid.UUID(vote.ContestID.Bytes).String()
	}
	if vote.ParticipantID.Valid {
		participantIDStr = uuid.UUID(vote.ParticipantID.Bytes).String()
	}
	var nom *string
	if vote.NominationID.Valid {
		s := uuid.UUID(vote.NominationID.Bytes).String()
		nom = &s
	}
	return &model.Vote{
		ID:            voteIDStr,
		ContestID:     model.ContestID(contestIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		NominationID:  nom,
		UserID:        model.UserID(vote.UserID),
		CreatedAt:     vote.CreatedAt.Time,
		UpdatedAt:     vote.UpdatedAt.Time,
	}
}

func (r *Repository) UpsertContestVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID, nominationID *string) (*model.Vote, error) {
	reposqlc := sqlc_repository.New(r.conn)
	voteUUID := uuid.New()
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	vote, err := reposqlc.UpsertContestVote(ctx, &sqlc_repository.UpsertContestVoteParams{
		ID:            pgtype.UUID{Bytes: voteUUID, Valid: true},
		ContestID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		UserID:        int64(userID),
		NominationID:  nominationUUIDForVote(nominationID),
	})
	if err != nil {
		return nil, err
	}

	return voteModelFromSQLc(vote), nil
}

func (r *Repository) ListContestVotesByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListContestVotesByUser(ctx, &sqlc_repository.ListContestVotesByUserParams{
		ContestID: pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:    int64(userID),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*model.Vote, 0, len(rows))
	for _, row := range rows {
		out = append(out, voteModelFromSQLc(row))
	}
	return out, nil
}

func (r *Repository) DeleteContestVoteByUserAndParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, participantID model.ParticipantID) (model.ParticipantID, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return "", err
	}
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return "", err
	}

	deletedParticipantID, err := reposqlc.DeleteContestVoteByUserAndParticipant(ctx, &sqlc_repository.DeleteContestVoteByUserAndParticipantParams{
		ContestID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:        int64(userID),
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return "", err
	}

	if deletedParticipantID.Valid {
		return model.ParticipantID(uuid.UUID(deletedParticipantID.Bytes).String()), nil
	}
	return "", nil
}

func (r *Repository) CountVotesByContest(ctx context.Context, contestID model.ContestID) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return 0, err
	}

	count, err := reposqlc.CountVotesByContest(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
	return count, err
}

func (r *Repository) CountVotesByParticipant(ctx context.Context, participantID model.ParticipantID) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return 0, err
	}

	count, err := reposqlc.CountVotesByParticipant(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	return count, err
}

// CountVotesByContests получает счетчики голосов для нескольких конкурсов одним запросом
// Оптимизирует N+1 проблему при получении списка конкурсов
func (r *Repository) CountVotesByContests(ctx context.Context, contestIDs []model.ContestID) (map[model.ContestID]int64, error) {
	if len(contestIDs) == 0 {
		return make(map[model.ContestID]int64), nil
	}

	contestUUIDs := make([]pgtype.UUID, 0, len(contestIDs))
	for _, contestID := range contestIDs {
		contestUUID, err := uuid.Parse(string(contestID))
		if err != nil {
			continue
		}
		contestUUIDs = append(contestUUIDs, pgtype.UUID{Bytes: contestUUID, Valid: true})
	}

	// Используем сырой SQL запрос для оптимизации
	query := `
		SELECT contest_id, count(1) as vote_count 
		FROM contest_votes
		WHERE contest_id = ANY($1::uuid[])
		GROUP BY contest_id
	`

	rows, err := r.conn.Query(ctx, query, contestUUIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[model.ContestID]int64)
	for rows.Next() {
		var contestUUID pgtype.UUID
		var count int64
		if err := rows.Scan(&contestUUID, &count); err != nil {
			return nil, err
		}
		if contestUUID.Valid {
			contestID := model.ContestID(uuid.UUID(contestUUID.Bytes).String())
			result[contestID] = count
		}
	}

	return result, rows.Err()
}

func (r *Repository) ListVotersByParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID) ([]*model.VoterInfo, error) {
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListVotersByParticipant(ctx, &sqlc_repository.ListVotersByParticipantParams{
		ContestID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	result := make([]*model.VoterInfo, 0, len(rows))
	for _, row := range rows {
		var votedAt time.Time
		if row.CreatedAt.Valid {
			votedAt = row.CreatedAt.Time
		}
		result = append(result, &model.VoterInfo{
			UserID:   model.UserID(row.UserID),
			UserName: row.UserName,
			VotedAt:  votedAt,
		})
	}
	return result, nil
}

func (r *Repository) UpsertContestUserVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID, nominationID *string) (*model.Vote, error) {
	reposqlc := sqlc_repository.New(r.conn)
	voteUUID := uuid.New()
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	vote, err := reposqlc.UpsertContestUserVote(ctx, &sqlc_repository.UpsertContestUserVoteParams{
		ID:            pgtype.UUID{Bytes: voteUUID, Valid: true},
		ContestID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		NominationID:  nominationUUIDForVote(nominationID),
		UserID:        int64(userID),
	})
	if err != nil {
		return nil, err
	}

	return voteModelFromUserSQLc(vote), nil
}

func (r *Repository) ListContestUserVotesByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListContestUserVotesByUser(ctx, &sqlc_repository.ListContestUserVotesByUserParams{
		ContestID: pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:    int64(userID),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*model.Vote, 0, len(rows))
	for _, row := range rows {
		out = append(out, voteModelFromUserSQLc(row))
	}
	return out, nil
}

func (r *Repository) DeleteContestUserVoteByUserAndParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, participantID model.ParticipantID) (model.ParticipantID, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return "", err
	}
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return "", err
	}

	deletedParticipantID, err := reposqlc.DeleteContestUserVoteByUserAndParticipant(ctx, &sqlc_repository.DeleteContestUserVoteByUserAndParticipantParams{
		ContestID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:        int64(userID),
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return "", err
	}

	if deletedParticipantID.Valid {
		return model.ParticipantID(uuid.UUID(deletedParticipantID.Bytes).String()), nil
	}
	return "", nil
}

func (r *Repository) CountContestUserVotesByContest(ctx context.Context, contestID model.ContestID) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return 0, err
	}
	return reposqlc.CountContestUserVotesByContest(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
}

func (r *Repository) CountContestUserVotesByParticipant(ctx context.Context, participantID model.ParticipantID) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return 0, err
	}
	return reposqlc.CountContestUserVotesByParticipant(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
}

func (r *Repository) ListContestUserVotersByParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID) ([]*model.VoterInfo, error) {
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListContestUserVotersByParticipant(ctx, &sqlc_repository.ListContestUserVotersByParticipantParams{
		ContestID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	result := make([]*model.VoterInfo, 0, len(rows))
	for _, row := range rows {
		var votedAt time.Time
		if row.CreatedAt.Valid {
			votedAt = row.CreatedAt.Time
		}
		result = append(result, &model.VoterInfo{
			UserID:   model.UserID(row.UserID),
			UserName: row.UserName,
			VotedAt:  votedAt,
		})
	}
	return result, nil
}
