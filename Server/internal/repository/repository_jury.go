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

func juryMemberFromJoinRow(
	id pgtype.UUID,
	contestID pgtype.UUID,
	userID int64,
	createdAt pgtype.Timestamptz,
	sortOrder int32,
	portfolioURL, bioShort, userName string,
) *model.JuryMember {
	var idStr, cidStr string
	if id.Valid {
		idStr = uuid.UUID(id.Bytes).String()
	}
	if contestID.Valid {
		cidStr = uuid.UUID(contestID.Bytes).String()
	}
	return &model.JuryMember{
		ID:             idStr,
		ContestID:      model.ContestID(cidStr),
		UserID:         model.UserID(userID),
		UserName:       userName,
		SortOrder:      sortOrder,
		PortfolioURL:   portfolioURL,
		BioShort:       bioShort,
		CreatedAt:      createdAt.Time,
	}
}

func juryMemberFromListRow(row *sqlc_repository.ListContestJuryMembersWithNamesRow) *model.JuryMember {
	return juryMemberFromJoinRow(
		row.ID, row.ContestID, row.UserID, row.CreatedAt,
		row.SortOrder, row.PortfolioUrl, row.BioShort, row.UserName,
	)
}

func juryMemberFromGetRow(row *sqlc_repository.GetContestJuryMemberWithNameRow) *model.JuryMember {
	return juryMemberFromJoinRow(
		row.ID, row.ContestID, row.UserID, row.CreatedAt,
		row.SortOrder, row.PortfolioUrl, row.BioShort, row.UserName,
	)
}

func (r *Repository) ListContestJuryMembers(ctx context.Context, contestID model.ContestID) ([]*model.JuryMember, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	rows, err := reposqlc.ListContestJuryMembersWithNames(ctx, cid)
	if err != nil {
		return nil, err
	}
	out := make([]*model.JuryMember, len(rows))
	for i, row := range rows {
		out[i] = juryMemberFromListRow(row)
	}
	return out, nil
}

func (r *Repository) GetContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.JuryMember, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.GetContestJuryMemberWithName(ctx, &sqlc_repository.GetContestJuryMemberWithNameParams{
		ContestID: cid,
		UserID:    int64(userID),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}
	return juryMemberFromGetRow(row), nil
}

func (r *Repository) UpdateContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID, portfolioURL, bioShort string, sortOrder int32) (*model.JuryMember, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	_, err = reposqlc.UpdateContestJuryMember(ctx, &sqlc_repository.UpdateContestJuryMemberParams{
		ContestID:    cid,
		UserID:       int64(userID),
		PortfolioUrl: portfolioURL,
		BioShort:     bioShort,
		SortOrder:    sortOrder,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}
	return r.GetContestJuryMember(ctx, contestID, userID)
}

func (r *Repository) ReorderContestJuryMembers(ctx context.Context, contestID model.ContestID, orderedUserIDs []model.UserID) error {
	b, ok := r.conn.(pgxBeginner)
	if !ok {
		return fmt.Errorf("repository does not support transactions")
	}
	tx, err := b.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	reposqlc := sqlc_repository.New(tx)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return err
	}
	rows, err := reposqlc.ListContestJuryMembersWithNames(ctx, cid)
	if err != nil {
		return err
	}
	existing := make(map[model.UserID]struct{}, len(rows))
	for _, row := range rows {
		existing[model.UserID(row.UserID)] = struct{}{}
	}
	if len(orderedUserIDs) != len(existing) {
		return fmt.Errorf("%w: jury order must list each member exactly once", model.ErrBadRequest)
	}
	seen := make(map[model.UserID]struct{})
	for _, uid := range orderedUserIDs {
		if _, ok := existing[uid]; !ok {
			return fmt.Errorf("%w: user is not a jury member", model.ErrBadRequest)
		}
		if _, dup := seen[uid]; dup {
			return fmt.Errorf("%w: duplicate user in jury order", model.ErrBadRequest)
		}
		seen[uid] = struct{}{}
	}
	for i, uid := range orderedUserIDs {
		if err := reposqlc.SetContestJuryMemberSortOrder(ctx, &sqlc_repository.SetContestJuryMemberSortOrderParams{
			ContestID: cid,
			UserID:    int64(uid),
			SortOrder: int32(i),
		}); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) AddContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.JuryMember, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	next, err := reposqlc.NextContestJurySortOrder(ctx, cid)
	if err != nil {
		return nil, err
	}
	jid := uuid.New()
	_, err = reposqlc.InsertContestJuryMember(ctx, &sqlc_repository.InsertContestJuryMemberParams{
		ID:        pgtype.UUID{Bytes: jid, Valid: true},
		ContestID: cid,
		UserID:    int64(userID),
		SortOrder: next,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, fmt.Errorf("%w: this user is already in the jury", model.ErrBadRequest)
		}
		return nil, err
	}
	row, err := reposqlc.GetContestJuryMemberWithName(ctx, &sqlc_repository.GetContestJuryMemberWithNameParams{
		ContestID: cid,
		UserID:    int64(userID),
	})
	if err != nil {
		return nil, err
	}
	return juryMemberFromGetRow(row), nil
}

func (r *Repository) RemoveContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) error {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return err
	}
	return reposqlc.DeleteContestJuryMember(ctx, &sqlc_repository.DeleteContestJuryMemberParams{
		ContestID: cid,
		UserID:    int64(userID),
	})
}

func (r *Repository) CountContestJuryMembers(ctx context.Context, contestID model.ContestID) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return 0, err
	}
	n, err := reposqlc.CountContestJuryMembers(ctx, cid)
	if err != nil {
		return 0, err
	}
	return n, nil
}

func (r *Repository) CountContestJuryCriteria(ctx context.Context, contestID model.ContestID) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return 0, err
	}
	n, err := reposqlc.CountContestJuryCriteria(ctx, cid)
	if err != nil {
		return 0, err
	}
	return n, nil
}

func (r *Repository) SearchUsersByQuery(ctx context.Context, q string, limit int32) ([]*model.UserSearchHit, error) {
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.SearchUsersByQuery(ctx, &sqlc_repository.SearchUsersByQueryParams{
		Column1: q,
		Limit:   limit,
	})
	if err != nil {
		return nil, err
	}
	out := make([]*model.UserSearchHit, len(rows))
	for i, row := range rows {
		email := ""
		if row.Email != nil {
			email = *row.Email
		}
		out[i] = &model.UserSearchHit{
			ID:    model.UserID(row.UserID),
			Name:  row.Name,
			Email: email,
		}
	}
	return out, nil
}
