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

func pgUUIDFromContestID(contestID model.ContestID) (pgtype.UUID, error) {
	cid, err := uuid.Parse(string(contestID))
	if err != nil {
		return pgtype.UUID{}, err
	}
	return pgtype.UUID{Bytes: cid, Valid: true}, nil
}

func (r *Repository) CreateNomination(ctx context.Context, contestID model.ContestID, title, description string, sortOrder int, minPhotoCount int32) (*model.Nomination, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	id := uuid.New()
	row, err := reposqlc.CreateNomination(ctx, &sqlc_repository.CreateNominationParams{
		ID:            pgtype.UUID{Bytes: id, Valid: true},
		ContestID:     cid,
		Title:         title,
		Description:   description,
		SortOrder:     int32(sortOrder),
		MinPhotoCount: minPhotoCount,
	})
	if err != nil {
		return nil, err
	}
	return nominationFromSQLc(row), nil
}

func (r *Repository) GetNominationByContest(ctx context.Context, contestID model.ContestID, nominationID string) (*model.Nomination, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	nid, err := uuid.Parse(nominationID)
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.GetNominationByContest(ctx, &sqlc_repository.GetNominationByContestParams{
		ID:        pgtype.UUID{Bytes: nid, Valid: true},
		ContestID: cid,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}
	return nominationFromSQLc(row), nil
}

func (r *Repository) UpdateNomination(ctx context.Context, contestID model.ContestID, nominationID string, title, description string, minPhotoCount int32) (*model.Nomination, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	nid, err := uuid.Parse(nominationID)
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.UpdateNomination(ctx, &sqlc_repository.UpdateNominationParams{
		ID:            pgtype.UUID{Bytes: nid, Valid: true},
		ContestID:     cid,
		Title:         title,
		Description:   description,
		MinPhotoCount: minPhotoCount,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}
	return nominationFromSQLc(row), nil
}

func (r *Repository) ListNominationsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListNominationsByContest(ctx, cid)
	if err != nil {
		return nil, err
	}
	out := make([]*model.Nomination, len(rows))
	for i, row := range rows {
		out[i] = nominationFromSQLc(row)
	}
	return out, nil
}

func (r *Repository) DeleteNomination(ctx context.Context, nominationID string) error {
	reposqlc := sqlc_repository.New(r.conn)
	id, err := uuid.Parse(nominationID)
	if err != nil {
		return err
	}
	return reposqlc.DeleteNomination(ctx, pgtype.UUID{Bytes: id, Valid: true})
}

func (r *Repository) CountNominationsByContest(ctx context.Context, contestID model.ContestID) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return 0, err
	}
	return reposqlc.CountNominationsByContest(ctx, cid)
}

func nominationFromSQLc(n *sqlc_repository.ContestNomination) *model.Nomination {
	var idStr, cidStr string
	if n.ID.Valid {
		idStr = uuid.UUID(n.ID.Bytes).String()
	}
	if n.ContestID.Valid {
		cidStr = uuid.UUID(n.ContestID.Bytes).String()
	}
	return &model.Nomination{
		ID:            idStr,
		ContestID:     model.ContestID(cidStr),
		Title:         n.Title,
		Description:   n.Description,
		SortOrder:     int(n.SortOrder),
		MinPhotoCount: int(n.MinPhotoCount),
		CreatedAt:     n.CreatedAt.Time,
	}
}

func (r *Repository) ListJuryCriteriaByContest(ctx context.Context, contestID model.ContestID) ([]*model.JuryCriterion, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListJuryCriteriaByContest(ctx, cid)
	if err != nil {
		return nil, err
	}
	out := make([]*model.JuryCriterion, len(rows))
	for i, row := range rows {
		out[i] = juryCriterionFromSQLc(row)
	}
	return out, nil
}

func (r *Repository) ReplaceContestJuryCriteria(ctx context.Context, contestID model.ContestID, items []*model.JuryCriterionInput) error {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return err
	}
	if err := reposqlc.DeleteJuryCriteriaByContest(ctx, cid); err != nil {
		return err
	}
	for i, it := range items {
		jid := uuid.New()
		_, err := reposqlc.InsertJuryCriterion(ctx, &sqlc_repository.InsertJuryCriterionParams{
			ID:          pgtype.UUID{Bytes: jid, Valid: true},
			ContestID:   cid,
			Title:       it.Title,
			Description: it.Description,
			ScaleMin:    it.ScaleMin,
			ScaleMax:    it.ScaleMax,
			ScaleStep:   it.ScaleStep,
			SortOrder:   int32(i),
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func juryCriterionFromSQLc(j *sqlc_repository.ContestJuryCriterium) *model.JuryCriterion {
	var idStr, cidStr string
	if j.ID.Valid {
		idStr = uuid.UUID(j.ID.Bytes).String()
	}
	if j.ContestID.Valid {
		cidStr = uuid.UUID(j.ContestID.Bytes).String()
	}
	return &model.JuryCriterion{
		ID:          idStr,
		ContestID:   model.ContestID(cidStr),
		Title:       j.Title,
		Description: j.Description,
		ScaleMin:    j.ScaleMin,
		ScaleMax:    j.ScaleMax,
		ScaleStep:   j.ScaleStep,
		SortOrder:   j.SortOrder,
		CreatedAt:   j.CreatedAt.Time,
	}
}
