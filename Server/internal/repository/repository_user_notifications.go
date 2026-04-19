package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func userNotificationFromRow(row *sqlc_repository.UserNotification) (*model.UserNotification, error) {
	if row == nil {
		return nil, errors.New("nil row")
	}
	idStr := ""
	if row.ID.Valid {
		idStr = uuid.UUID(row.ID.Bytes).String()
	}
	var readAt *time.Time
	if row.ReadAt.Valid {
		t := row.ReadAt.Time
		readAt = &t
	}
	createdAt := time.Time{}
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time
	}
	payload := json.RawMessage(nil)
	if len(row.Payload) > 0 {
		payload = append(json.RawMessage(nil), row.Payload...)
	}
	return &model.UserNotification{
		ID:        model.UserNotificationID(idStr),
		UserID:    model.UserID(row.UserID),
		Kind:      row.Kind,
		Payload:   payload,
		ReadAt:    readAt,
		CreatedAt: createdAt,
	}, nil
}

func (r *Repository) InsertUserNotification(ctx context.Context, userID model.UserID, kind string, payload json.RawMessage) (*model.UserNotification, error) {
	reposqlc := sqlc_repository.New(r.conn)
	row, err := reposqlc.InsertUserNotification(ctx, &sqlc_repository.InsertUserNotificationParams{
		UserID:  int64(userID),
		Kind:    kind,
		Payload: []byte(payload),
	})
	if err != nil {
		return nil, err
	}
	return userNotificationFromRow(row)
}

func (r *Repository) CountUnreadUserNotifications(ctx context.Context, userID model.UserID) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	return reposqlc.CountUnreadUserNotifications(ctx, int64(userID))
}

func (r *Repository) ListUserNotificationsForUser(ctx context.Context, userID model.UserID, limit int32, cursorCreatedAt *time.Time, cursorID *model.UserNotificationID) ([]*model.UserNotification, error) {
	reposqlc := sqlc_repository.New(r.conn)
	arg := &sqlc_repository.ListUserNotificationsForUserParams{
		UserID: int64(userID),
		Limit:  limit,
	}
	if cursorCreatedAt != nil && cursorID != nil && *cursorID != "" {
		parsed, err := uuid.Parse(string(*cursorID))
		if err != nil {
			return nil, fmt.Errorf("invalid cursor id: %w", err)
		}
		arg.CursorCreatedAt = pgtype.Timestamptz{Time: *cursorCreatedAt, Valid: true}
		arg.CursorID = pgtype.UUID{Bytes: parsed, Valid: true}
	}
	rows, err := reposqlc.ListUserNotificationsForUser(ctx, arg)
	if err != nil {
		return nil, err
	}
	out := make([]*model.UserNotification, 0, len(rows))
	for _, row := range rows {
		n, err := userNotificationFromRow(row)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

func (r *Repository) MarkUserNotificationReadByOwner(ctx context.Context, id model.UserNotificationID, ownerUserID model.UserID) (*model.UserNotification, error) {
	reposqlc := sqlc_repository.New(r.conn)
	parsed, err := uuid.Parse(string(id))
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.MarkUserNotificationReadByOwner(ctx, &sqlc_repository.MarkUserNotificationReadByOwnerParams{
		ID:     pgtype.UUID{Bytes: parsed, Valid: true},
		UserID: int64(ownerUserID),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrorNotFound
		}
		return nil, err
	}
	return userNotificationFromRow(row)
}

func (r *Repository) MarkAllUserNotificationsRead(ctx context.Context, userID model.UserID) error {
	reposqlc := sqlc_repository.New(r.conn)
	return reposqlc.MarkAllUserNotificationsRead(ctx, int64(userID))
}
