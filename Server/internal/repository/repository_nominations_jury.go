package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

// Нужен пул с транзакциями; иначе синхронизация критериев недоступна.
type pgxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

func pgUUIDFromContestID(contestID model.ContestID) (pgtype.UUID, error) {
	cid, err := uuid.Parse(string(contestID))
	if err != nil {
		return pgtype.UUID{}, err
	}
	return pgtype.UUID{Bytes: cid, Valid: true}, nil
}

func (r *Repository) CreateNomination(ctx context.Context, contestID model.ContestID, title, description string, sortOrder int, minPhotoCount int32, maxPhotoCount int32) (*model.Nomination, error) {
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
		MaxPhotoCount: maxPhotoCount,
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

func (r *Repository) UpdateNomination(ctx context.Context, contestID model.ContestID, nominationID string, title, description string, minPhotoCount int32, maxPhotoCount int32) (*model.Nomination, error) {
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
		MaxPhotoCount: maxPhotoCount,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}
	return nominationFromSQLc(row), nil
}

func (r *Repository) UpdateNominationLogoUrl(ctx context.Context, contestID model.ContestID, nominationID string, logoURL string) (*model.Nomination, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	nid, err := uuid.Parse(nominationID)
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.UpdateNominationLogoUrl(ctx, &sqlc_repository.UpdateNominationLogoUrlParams{
		ID:        pgtype.UUID{Bytes: nid, Valid: true},
		ContestID: cid,
		LogoUrl:   logoURL,
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

func (r *Repository) ListNominationsForContests(ctx context.Context, contestIDs []model.ContestID) ([]*model.Nomination, error) {
	if len(contestIDs) == 0 {
		return nil, nil
	}
	arr := make([]pgtype.UUID, 0, len(contestIDs))
	for _, cid := range contestIDs {
		u, err := uuid.Parse(string(cid))
		if err != nil {
			continue
		}
		arr = append(arr, pgtype.UUID{Bytes: u, Valid: true})
	}
	if len(arr) == 0 {
		return nil, nil
	}
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListNominationsForContests(ctx, arr)
	if err != nil {
		return nil, err
	}
	out := make([]*model.Nomination, 0, len(rows))
	for _, row := range rows {
		out = append(out, nominationFromSQLc(row))
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

// ReorderNominationsByContest выставляет sort_order = 0..len-1 в порядке orderedIDs. Транзакция.
func (r *Repository) ReorderNominationsByContest(ctx context.Context, contestID model.ContestID, orderedIDs []string) error {
	b, ok := r.conn.(pgxBeginner)
	if !ok {
		return fmt.Errorf("database connection does not support transactions")
	}
	tx, err := b.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	reposqlc := sqlc_repository.New(tx)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return err
	}

	for i, idStr := range orderedIDs {
		nid, err := uuid.Parse(strings.TrimSpace(idStr))
		if err != nil {
			return fmt.Errorf("%w: invalid nomination id", model.ErrBadRequest)
		}
		n, err := reposqlc.UpdateNominationSortOrder(ctx, &sqlc_repository.UpdateNominationSortOrderParams{
			ID:        pgtype.UUID{Bytes: nid, Valid: true},
			ContestID: cid,
			SortOrder: int32(i),
		})
		if err != nil {
			return err
		}
		if n != 1 {
			return fmt.Errorf("%w: nomination not in this contest", model.ErrorNotFound)
		}
	}

	return tx.Commit(ctx)
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
		MaxPhotoCount: int(n.MaxPhotoCount),
		LogoUrl:       n.LogoUrl,
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
	b, ok := r.conn.(pgxBeginner)
	if !ok {
		return fmt.Errorf("database connection does not support transactions")
	}
	tx, err := b.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	reposqlc := sqlc_repository.New(tx)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return err
	}

	existing, err := reposqlc.ListJuryCriteriaByContest(ctx, cid)
	if err != nil {
		return err
	}

	existByID := make(map[uuid.UUID]struct{}, len(existing))
	orderedExisting := make([]uuid.UUID, 0, len(existing))
	for _, row := range existing {
		if !row.ID.Valid {
			continue
		}
		id := uuid.UUID(row.ID.Bytes)
		existByID[id] = struct{}{}
		orderedExisting = append(orderedExisting, id)
	}

	anyExplicitID := false
	for _, it := range items {
		if strings.TrimSpace(it.ID) != "" {
			anyExplicitID = true
			break
		}
	}

	kept := make(map[uuid.UUID]struct{})
	seenInRequest := make(map[uuid.UUID]struct{})

	if !anyExplicitID {
		// Старые клиенты и «сохранить конкурс» без id: обновляем по позиции, сохраняем UUID критериев и оценки.
		for i, it := range items {
			sortOrder := int32(i)
			if i < len(orderedExisting) {
				eid := orderedExisting[i]
				if _, err := reposqlc.UpdateJuryCriterion(ctx, &sqlc_repository.UpdateJuryCriterionParams{
					ID:          pgtype.UUID{Bytes: eid, Valid: true},
					ContestID:   cid,
					Title:       it.Title,
					Description: it.Description,
					ScaleMin:    it.ScaleMin,
					ScaleMax:    it.ScaleMax,
					ScaleStep:   it.ScaleStep,
					SortOrder:   sortOrder,
					Weight:      it.Weight,
				}); err != nil {
					if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
						return fmt.Errorf("%w: criterion update", model.ErrorNotFound)
					}
					return err
				}
				kept[eid] = struct{}{}
				continue
			}
			jid := uuid.New()
			if _, err := reposqlc.InsertJuryCriterion(ctx, &sqlc_repository.InsertJuryCriterionParams{
				ID:          pgtype.UUID{Bytes: jid, Valid: true},
				ContestID:   cid,
				Title:       it.Title,
				Description: it.Description,
				ScaleMin:    it.ScaleMin,
				ScaleMax:    it.ScaleMax,
				ScaleStep:   it.ScaleStep,
				SortOrder:   sortOrder,
				Weight:      it.Weight,
			}); err != nil {
				return err
			}
			kept[jid] = struct{}{}
		}
		for j := len(items); j < len(orderedExisting); j++ {
			eid := orderedExisting[j]
			if err := reposqlc.DeleteJuryCriterionForContest(ctx, &sqlc_repository.DeleteJuryCriterionForContestParams{
				ID:        pgtype.UUID{Bytes: eid, Valid: true},
				ContestID: cid,
			}); err != nil {
				return err
			}
		}
	} else {
		for i, it := range items {
			sortOrder := int32(i)
			idStr := strings.TrimSpace(it.ID)
			if idStr != "" {
				critUUID, perr := uuid.Parse(idStr)
				if perr != nil {
					return fmt.Errorf("%w: invalid criterion id", model.ErrBadRequest)
				}
				if _, ok := existByID[critUUID]; !ok {
					return fmt.Errorf("%w: criterion not in this contest", model.ErrorNotFound)
				}
				if _, dup := seenInRequest[critUUID]; dup {
					return fmt.Errorf("%w: duplicate criterion id in request", model.ErrBadRequest)
				}
				seenInRequest[critUUID] = struct{}{}
				if _, err := reposqlc.UpdateJuryCriterion(ctx, &sqlc_repository.UpdateJuryCriterionParams{
					ID:          pgtype.UUID{Bytes: critUUID, Valid: true},
					ContestID:   cid,
					Title:       it.Title,
					Description: it.Description,
					ScaleMin:    it.ScaleMin,
					ScaleMax:    it.ScaleMax,
					ScaleStep:   it.ScaleStep,
					SortOrder:   sortOrder,
					Weight:      it.Weight,
				}); err != nil {
					if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
						return fmt.Errorf("%w: criterion not found", model.ErrorNotFound)
					}
					return err
				}
				kept[critUUID] = struct{}{}
				continue
			}
			jid := uuid.New()
			if _, err := reposqlc.InsertJuryCriterion(ctx, &sqlc_repository.InsertJuryCriterionParams{
				ID:          pgtype.UUID{Bytes: jid, Valid: true},
				ContestID:   cid,
				Title:       it.Title,
				Description: it.Description,
				ScaleMin:    it.ScaleMin,
				ScaleMax:    it.ScaleMax,
				ScaleStep:   it.ScaleStep,
				SortOrder:   sortOrder,
				Weight:      it.Weight,
			}); err != nil {
				return err
			}
			kept[jid] = struct{}{}
		}
		for _, eid := range orderedExisting {
			if _, ok := kept[eid]; !ok {
				if err := reposqlc.DeleteJuryCriterionForContest(ctx, &sqlc_repository.DeleteJuryCriterionForContestParams{
					ID:        pgtype.UUID{Bytes: eid, Valid: true},
					ContestID: cid,
				}); err != nil {
					return err
				}
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
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
		Weight:      j.Weight,
		CreatedAt:   j.CreatedAt.Time,
	}
}
