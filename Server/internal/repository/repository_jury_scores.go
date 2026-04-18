package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func (r *Repository) IsContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (bool, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return false, err
	}
	return reposqlc.IsContestJuryMember(ctx, &sqlc_repository.IsContestJuryMemberParams{
		ContestID: cid,
		UserID:    int64(userID),
	})
}

func (r *Repository) UpsertContestJuryScore(ctx context.Context, participantID model.ParticipantID, criterionID string, userID model.UserID, score int32) (*model.JuryScore, error) {
	reposqlc := sqlc_repository.New(r.conn)
	pid, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}
	crit, err := uuid.Parse(criterionID)
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.UpsertContestJuryScore(ctx, &sqlc_repository.UpsertContestJuryScoreParams{
		ID:            pgtype.UUID{Bytes: uuid.New(), Valid: true},
		ParticipantID: pgtype.UUID{Bytes: pid, Valid: true},
		CriterionID:   pgtype.UUID{Bytes: crit, Valid: true},
		UserID:        int64(userID),
		Score:         score,
	})
	if err != nil {
		return nil, err
	}
	return juryScoreFromSQLc(row), nil
}

func (r *Repository) SumJuryScoresByParticipantID(ctx context.Context, participantID model.ParticipantID) (float64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	pid, err := uuid.Parse(string(participantID))
	if err != nil {
		return 0, err
	}
	return reposqlc.SumJuryScoresByParticipantID(ctx, pgtype.UUID{Bytes: pid, Valid: true})
}

func (r *Repository) SumJuryScoresByParticipantIDs(ctx context.Context, participantIDs []model.ParticipantID) (map[model.ParticipantID]float64, error) {
	if len(participantIDs) == 0 {
		return map[model.ParticipantID]float64{}, nil
	}
	reposqlc := sqlc_repository.New(r.conn)
	arr := make([]pgtype.UUID, 0, len(participantIDs))
	for _, id := range participantIDs {
		pid, err := uuid.Parse(string(id))
		if err != nil {
			return nil, err
		}
		arr = append(arr, pgtype.UUID{Bytes: pid, Valid: true})
	}
	rows, err := reposqlc.SumJuryScoresByParticipantIDs(ctx, arr)
	if err != nil {
		return nil, err
	}
	out := make(map[model.ParticipantID]float64, len(rows))
	for _, row := range rows {
		if !row.ParticipantID.Valid {
			continue
		}
		out[model.ParticipantID(uuid.UUID(row.ParticipantID.Bytes).String())] = row.TotalScore
	}
	return out, nil
}

func (r *Repository) CountJuryFullyScoredJurorsByParticipantIDs(ctx context.Context, participantIDs []model.ParticipantID) (map[model.ParticipantID]int64, error) {
	if len(participantIDs) == 0 {
		return map[model.ParticipantID]int64{}, nil
	}
	reposqlc := sqlc_repository.New(r.conn)
	arr := make([]pgtype.UUID, 0, len(participantIDs))
	for _, id := range participantIDs {
		pid, err := uuid.Parse(string(id))
		if err != nil {
			return nil, err
		}
		arr = append(arr, pgtype.UUID{Bytes: pid, Valid: true})
	}
	rows, err := reposqlc.CountJuryFullyScoredJurorsByParticipantIDs(ctx, arr)
	if err != nil {
		return nil, err
	}
	out := make(map[model.ParticipantID]int64, len(rows))
	for _, row := range rows {
		if !row.ParticipantID.Valid {
			continue
		}
		out[model.ParticipantID(uuid.UUID(row.ParticipantID.Bytes).String())] = row.FullyScoredJurors
	}
	return out, nil
}

func (r *Repository) ListContestJuryScoresByParticipantAndUser(ctx context.Context, participantID model.ParticipantID, userID model.UserID) ([]*model.JuryScore, error) {
	reposqlc := sqlc_repository.New(r.conn)
	pid, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListContestJuryScoresByParticipantAndUser(ctx, &sqlc_repository.ListContestJuryScoresByParticipantAndUserParams{
		ParticipantID: pgtype.UUID{Bytes: pid, Valid: true},
		UserID:        int64(userID),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*model.JuryScore, len(rows))
	for i, row := range rows {
		out[i] = juryScoreFromSQLc(row)
	}
	return out, nil
}

func (r *Repository) ListContestJuryScoresReportByParticipant(ctx context.Context, participantID model.ParticipantID) ([]*model.JuryScoreReportItem, error) {
	reposqlc := sqlc_repository.New(r.conn)
	pid, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListContestJuryScoresReportByParticipant(ctx, pgtype.UUID{Bytes: pid, Valid: true})
	if err != nil {
		return nil, err
	}
	out := make([]*model.JuryScoreReportItem, 0, len(rows))
	for _, row := range rows {
		var critStr string
		if row.CriterionID.Valid {
			critStr = uuid.UUID(row.CriterionID.Bytes).String()
		}
		var updated time.Time
		if row.ScoreUpdatedAt.Valid {
			updated = row.ScoreUpdatedAt.Time
		}
		out = append(out, &model.JuryScoreReportItem{
			JurorUserID:        model.UserID(row.JurorUserID),
			JurorName:          row.JurorName,
			CriterionID:        critStr,
			CriterionTitle:     row.CriterionTitle,
			CriterionSortOrder: row.CriterionSortOrder,
			ScaleMin:           row.ScaleMin,
			ScaleMax:           row.ScaleMax,
			Score:              row.Score,
			ScoreUpdatedAt:     updated,
		})
	}
	return out, nil
}

func (r *Repository) ListContestJuryVotingProgressByContest(ctx context.Context, contestID model.ContestID) ([]*model.JuryVotingProgressRow, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListContestJuryVotingProgressByContest(ctx, cid)
	if err != nil {
		return nil, err
	}
	out := make([]*model.JuryVotingProgressRow, 0, len(rows))
	for _, row := range rows {
		var pidStr string
		if row.ParticipantID.Valid {
			pidStr = uuid.UUID(row.ParticipantID.Bytes).String()
		}
		out = append(out, &model.JuryVotingProgressRow{
			ParticipantID:    model.ParticipantID(pidStr),
			PetName:          row.PetName,
			SubmissionStatus: row.SubmissionStatus,
			JurorUserID:      model.UserID(row.JurorUserID),
			JurorName:        row.JurorName,
			CriteriaScored:   row.CriteriaScored,
		})
	}
	return out, nil
}

func (r *Repository) ListJuryWeightedTotalsByContest(ctx context.Context, contestID model.ContestID) ([]model.JuryChairWeightedCell, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListJuryWeightedTotalsByContest(ctx, cid)
	if err != nil {
		return nil, err
	}
	out := make([]model.JuryChairWeightedCell, 0, len(rows))
	for _, row := range rows {
		var pidStr string
		if row.ParticipantID.Valid {
			pidStr = uuid.UUID(row.ParticipantID.Bytes).String()
		}
		out = append(out, model.JuryChairWeightedCell{
			ParticipantID: model.ParticipantID(pidStr),
			JurorUserID:   model.UserID(row.JurorUserID),
			WeightedTotal: row.WeightedTotal,
		})
	}
	return out, nil
}

func juryScoreFromSQLc(row *sqlc_repository.ContestJuryScore) *model.JuryScore {
	var idStr, pidStr, critStr string
	if row.ID.Valid {
		idStr = uuid.UUID(row.ID.Bytes).String()
	}
	if row.ParticipantID.Valid {
		pidStr = uuid.UUID(row.ParticipantID.Bytes).String()
	}
	if row.CriterionID.Valid {
		critStr = uuid.UUID(row.CriterionID.Bytes).String()
	}
	return &model.JuryScore{
		ID:            idStr,
		ParticipantID: model.ParticipantID(pidStr),
		CriterionID:   critStr,
		UserID:        model.UserID(row.UserID),
		Score:         row.Score,
		CreatedAt:     row.CreatedAt.Time,
		UpdatedAt:     row.UpdatedAt.Time,
	}
}
