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

func (r *Repository) UpsertPhotoLike(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error) {
	reposqlc := sqlc_repository.New(r.conn)
	likeUUID := uuid.New()
	photoUUID, err := uuid.Parse(photoID)
	if err != nil {
		return nil, err
	}

	like, err := reposqlc.UpsertPhotoLike(ctx, &sqlc_repository.UpsertPhotoLikeParams{
		ID:      pgtype.UUID{Bytes: likeUUID, Valid: true},
		PhotoID: pgtype.UUID{Bytes: photoUUID, Valid: true},
		UserID:  int64(userID),
	})
	if err != nil {
		return nil, err
	}

	var likeIDStr, photoIDStr string
	if like.ID.Valid {
		likeIDStr = uuid.UUID(like.ID.Bytes).String()
	}
	if like.PhotoID.Valid {
		photoIDStr = uuid.UUID(like.PhotoID.Bytes).String()
	}

	return &model.PhotoLike{
		ID:        likeIDStr,
		PhotoID:   photoIDStr,
		UserID:    model.UserID(like.UserID),
		CreatedAt: like.CreatedAt.Time,
	}, nil
}

func (r *Repository) DeletePhotoLike(ctx context.Context, photoID string, userID model.UserID) error {
	reposqlc := sqlc_repository.New(r.conn)
	photoUUID, err := uuid.Parse(photoID)
	if err != nil {
		return err
	}

	err = reposqlc.DeletePhotoLike(ctx, &sqlc_repository.DeletePhotoLikeParams{
		PhotoID: pgtype.UUID{Bytes: photoUUID, Valid: true},
		UserID:  int64(userID),
	})
	return err
}

func (r *Repository) GetPhotoLikeByUser(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error) {
	reposqlc := sqlc_repository.New(r.conn)
	photoUUID, err := uuid.Parse(photoID)
	if err != nil {
		return nil, err
	}

	like, err := reposqlc.GetPhotoLikeByUser(ctx, &sqlc_repository.GetPhotoLikeByUserParams{
		PhotoID: pgtype.UUID{Bytes: photoUUID, Valid: true},
		UserID:  int64(userID),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	var likeIDStr, photoIDStr string
	if like.ID.Valid {
		likeIDStr = uuid.UUID(like.ID.Bytes).String()
	}
	if like.PhotoID.Valid {
		photoIDStr = uuid.UUID(like.PhotoID.Bytes).String()
	}

	return &model.PhotoLike{
		ID:        likeIDStr,
		PhotoID:   photoIDStr,
		UserID:    model.UserID(like.UserID),
		CreatedAt: like.CreatedAt.Time,
	}, nil
}

func (r *Repository) CountPhotoLikes(ctx context.Context, photoID string) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	photoUUID, err := uuid.Parse(photoID)
	if err != nil {
		return 0, err
	}

	count, err := reposqlc.CountPhotoLikes(ctx, pgtype.UUID{Bytes: photoUUID, Valid: true})
	return count, err
}

func (r *Repository) ListPhotoLikesByPhotos(ctx context.Context, photoIDs []string, userID model.UserID) (map[string]*model.PhotoLike, error) {
	reposqlc := sqlc_repository.New(r.conn)
	photoUUIDs := make([]pgtype.UUID, 0, len(photoIDs))
	for _, photoID := range photoIDs {
		photoUUID, err := uuid.Parse(photoID)
		if err != nil {
			continue
		}
		photoUUIDs = append(photoUUIDs, pgtype.UUID{Bytes: photoUUID, Valid: true})
	}

	likes, err := reposqlc.ListPhotoLikesByPhotos(ctx, &sqlc_repository.ListPhotoLikesByPhotosParams{
		Column1: photoUUIDs,
		UserID:   int64(userID),
	})
	if err != nil {
		return nil, err
	}

	result := make(map[string]*model.PhotoLike)
	for _, like := range likes {
		var likeIDStr, photoIDStr string
		if like.ID.Valid {
			likeIDStr = uuid.UUID(like.ID.Bytes).String()
		}
		if like.PhotoID.Valid {
			photoIDStr = uuid.UUID(like.PhotoID.Bytes).String()
		}
		result[photoIDStr] = &model.PhotoLike{
			ID:        likeIDStr,
			PhotoID:   photoIDStr,
			UserID:    model.UserID(like.UserID),
			CreatedAt: like.CreatedAt.Time,
		}
	}
	return result, nil
}
