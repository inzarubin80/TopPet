package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

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

func juryMemberFromListRow(row *sqlc_repository.ListContestJuryMembersWithNamesRow) *model.JuryMember {
	var idStr, cidStr string
	if row.ID.Valid {
		idStr = uuid.UUID(row.ID.Bytes).String()
	}
	if row.ContestID.Valid {
		cidStr = uuid.UUID(row.ContestID.Bytes).String()
	}
	return &model.JuryMember{
		ID:        idStr,
		ContestID: model.ContestID(cidStr),
		UserID:    model.UserID(row.UserID),
		UserName:  row.UserName,
		CreatedAt: row.CreatedAt.Time,
	}
}

func (r *Repository) AddContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.JuryMember, error) {
	reposqlc := sqlc_repository.New(r.conn)
	cid, err := pgUUIDFromContestID(contestID)
	if err != nil {
		return nil, err
	}
	jid := uuid.New()
	row, err := reposqlc.InsertContestJuryMember(ctx, &sqlc_repository.InsertContestJuryMemberParams{
		ID:        pgtype.UUID{Bytes: jid, Valid: true},
		ContestID: cid,
		UserID:    int64(userID),
	})
	if err != nil {
		return nil, err
	}
	u, err := reposqlc.GetUserByID(ctx, int64(userID))
	if err != nil {
		return nil, err
	}
	var idStr, cidStr string
	if row.ID.Valid {
		idStr = uuid.UUID(row.ID.Bytes).String()
	}
	if row.ContestID.Valid {
		cidStr = uuid.UUID(row.ContestID.Bytes).String()
	}
	return &model.JuryMember{
		ID:        idStr,
		ContestID: model.ContestID(cidStr),
		UserID:    model.UserID(row.UserID),
		UserName:  u.Name,
		CreatedAt: row.CreatedAt.Time,
	}, nil
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
