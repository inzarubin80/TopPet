package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (r *Repository) CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID := uuid.New()

	contest, err := reposqlc.CreateContest(ctx, &sqlc_repository.CreateContestParams{
		ID:              pgtype.UUID{Bytes: contestUUID, Valid: true},
		CreatedByUserID: int64(userID),
		Title:           title,
		Description:     description,
		Status:          string(model.ContestStatusDraft),
	})
	if err != nil {
		return nil, err
	}

	var contestIDStr string
	if contest.ID.Valid {
		contestIDStr = uuid.UUID(contest.ID.Bytes).String()
	}

	return &model.Contest{
		ID:              model.ContestID(contestIDStr),
		CreatedByUserID: model.UserID(contest.CreatedByUserID),
		Title:           contest.Title,
		Description:     contest.Description,
		Status:          model.ContestStatus(contest.Status),
		CreatedAt:       contest.CreatedAt.Time,
		UpdatedAt:       contest.UpdatedAt.Time,
	}, nil
}

func (r *Repository) GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	contest, err := reposqlc.GetContestByID(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	var contestIDStr string
	if contest.ID.Valid {
		contestIDStr = uuid.UUID(contest.ID.Bytes).String()
	}

	return &model.Contest{
		ID:              model.ContestID(contestIDStr),
		CreatedByUserID: model.UserID(contest.CreatedByUserID),
		Title:           contest.Title,
		Description:     contest.Description,
		Status:          model.ContestStatus(contest.Status),
		CreatedAt:       contest.CreatedAt.Time,
		UpdatedAt:       contest.UpdatedAt.Time,
	}, nil
}

func (r *Repository) ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)

	var statusStr *string
	if status != nil {
		s := string(*status)
		statusStr = &s
	}

	contests, err := reposqlc.ListContests(ctx, &sqlc_repository.ListContestsParams{
		Column1: func() string {
			if statusStr != nil {
				return *statusStr
			}
			return ""
		}(),
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := reposqlc.CountContests(ctx, func() string {
		if statusStr != nil {
			return *statusStr
		}
		return ""
	}())
	if err != nil {
		return nil, 0, err
	}

	result := make([]*model.Contest, len(contests))
	for i, c := range contests {
		var contestIDStr string
		if c.ID.Valid {
			contestIDStr = uuid.UUID(c.ID.Bytes).String()
		}

		result[i] = &model.Contest{
			ID:              model.ContestID(contestIDStr),
			CreatedByUserID: model.UserID(c.CreatedByUserID),
			Title:           c.Title,
			Description:     c.Description,
			Status:          model.ContestStatus(c.Status),
			CreatedAt:       c.CreatedAt.Time,
			UpdatedAt:       c.UpdatedAt.Time,
		}
	}

	return result, total, nil
}

func (r *Repository) UpdateContest(ctx context.Context, contestID model.ContestID, title, description string) (*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	contest, err := reposqlc.UpdateContest(ctx, &sqlc_repository.UpdateContestParams{
		ID:          pgtype.UUID{Bytes: contestUUID, Valid: true},
		Title:       title,
		Description: description,
	})
	if err != nil {
		return nil, err
	}

	var contestIDStr string
	if contest.ID.Valid {
		contestIDStr = uuid.UUID(contest.ID.Bytes).String()
	}

	return &model.Contest{
		ID:              model.ContestID(contestIDStr),
		CreatedByUserID: model.UserID(contest.CreatedByUserID),
		Title:           contest.Title,
		Description:     contest.Description,
		Status:          model.ContestStatus(contest.Status),
		CreatedAt:       contest.CreatedAt.Time,
		UpdatedAt:       contest.UpdatedAt.Time,
	}, nil
}

func (r *Repository) UpdateContestStatus(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	contest, err := reposqlc.UpdateContestStatus(ctx, &sqlc_repository.UpdateContestStatusParams{
		ID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		Status: string(status),
	})
	if err != nil {
		return nil, err
	}

	var contestIDStr string
	if contest.ID.Valid {
		contestIDStr = uuid.UUID(contest.ID.Bytes).String()
	}

	return &model.Contest{
		ID:              model.ContestID(contestIDStr),
		CreatedByUserID: model.UserID(contest.CreatedByUserID),
		Title:           contest.Title,
		Description:     contest.Description,
		Status:          model.ContestStatus(contest.Status),
		CreatedAt:       contest.CreatedAt.Time,
		UpdatedAt:       contest.UpdatedAt.Time,
	}, nil
}
