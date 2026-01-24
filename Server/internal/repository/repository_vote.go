package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func (r *Repository) UpsertContestVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error) {
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
	})
	if err != nil {
		return nil, err
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

	return &model.Vote{
		ID:            voteIDStr,
		ContestID:     model.ContestID(contestIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		UserID:        model.UserID(vote.UserID),
		CreatedAt:     vote.CreatedAt.Time,
		UpdatedAt:     vote.UpdatedAt.Time,
	}, nil
}

func (r *Repository) GetContestVoteByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Vote, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	vote, err := reposqlc.GetContestVoteByUser(ctx, &sqlc_repository.GetContestVoteByUserParams{
		ContestID: pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:    int64(userID),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
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

	return &model.Vote{
		ID:            voteIDStr,
		ContestID:     model.ContestID(contestIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		UserID:        model.UserID(vote.UserID),
		CreatedAt:     vote.CreatedAt.Time,
		UpdatedAt:     vote.UpdatedAt.Time,
	}, nil
}

func (r *Repository) DeleteContestVoteByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (model.ParticipantID, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return "", err
	}

	participantID, err := reposqlc.DeleteContestVoteByUser(ctx, &sqlc_repository.DeleteContestVoteByUserParams{
		ContestID: pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:    int64(userID),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return "", err
	}

	if participantID.Valid {
		return model.ParticipantID(uuid.UUID(participantID.Bytes).String()), nil
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
