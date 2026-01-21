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

func (r *Repository) CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string) (*model.Comment, error) {
	reposqlc := sqlc_repository.New(r.conn)
	commentUUID := uuid.New()
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	comment, err := reposqlc.CreateComment(ctx, &sqlc_repository.CreateCommentParams{
		ID:            pgtype.UUID{Bytes: commentUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		UserID:        int64(userID),
		Text:          text,
	})
	if err != nil {
		return nil, err
	}

	var commentIDStr, participantIDStr string
	if comment.ID.Valid {
		commentIDStr = uuid.UUID(comment.ID.Bytes).String()
	}
	if comment.ParticipantID.Valid {
		participantIDStr = uuid.UUID(comment.ParticipantID.Bytes).String()
	}

	return &model.Comment{
		ID:            model.CommentID(commentIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		UserID:        model.UserID(comment.UserID),
		Text:          comment.Text,
		CreatedAt:     comment.CreatedAt.Time,
		UpdatedAt:     comment.UpdatedAt.Time,
	}, nil
}

func (r *Repository) GetComment(ctx context.Context, commentID model.CommentID) (*model.Comment, error) {
	reposqlc := sqlc_repository.New(r.conn)
	commentUUID, err := uuid.Parse(string(commentID))
	if err != nil {
		return nil, err
	}

	comment, err := reposqlc.GetCommentByID(ctx, pgtype.UUID{Bytes: commentUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	var commentIDStr, participantIDStr string
	if comment.ID.Valid {
		commentIDStr = uuid.UUID(comment.ID.Bytes).String()
	}
	if comment.ParticipantID.Valid {
		participantIDStr = uuid.UUID(comment.ParticipantID.Bytes).String()
	}

	return &model.Comment{
		ID:            model.CommentID(commentIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		UserID:        model.UserID(comment.UserID),
		Text:          comment.Text,
		CreatedAt:     comment.CreatedAt.Time,
		UpdatedAt:     comment.UpdatedAt.Time,
	}, nil
}

func (r *Repository) ListCommentsByParticipant(ctx context.Context, participantID model.ParticipantID, limit, offset int) ([]*model.Comment, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)

	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, 0, err
	}

	comments, err := reposqlc.ListCommentsByParticipant(ctx, &sqlc_repository.ListCommentsByParticipantParams{
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		Limit:         int32(limit),
		Offset:        int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := reposqlc.CountCommentsByParticipant(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	if err != nil {
		return nil, 0, err
	}

	result := make([]*model.Comment, len(comments))
	for i, c := range comments {
		var commentIDStr, participantIDStr string
		if c.ID.Valid {
			commentIDStr = uuid.UUID(c.ID.Bytes).String()
		}
		if c.ParticipantID.Valid {
			participantIDStr = uuid.UUID(c.ParticipantID.Bytes).String()
		}

		result[i] = &model.Comment{
			ID:            model.CommentID(commentIDStr),
			ParticipantID: model.ParticipantID(participantIDStr),
			UserID:        model.UserID(c.UserID),
			Text:          c.Text,
			CreatedAt:     c.CreatedAt.Time,
			UpdatedAt:     c.UpdatedAt.Time,
		}
	}

	return result, total, nil
}

func (r *Repository) UpdateComment(ctx context.Context, commentID model.CommentID, userID model.UserID, text string) (*model.Comment, error) {
	reposqlc := sqlc_repository.New(r.conn)
	commentUUID, err := uuid.Parse(string(commentID))
	if err != nil {
		return nil, err
	}

	comment, err := reposqlc.UpdateComment(ctx, &sqlc_repository.UpdateCommentParams{
		Text:   text,
		ID:     pgtype.UUID{Bytes: commentUUID, Valid: true},
		UserID: int64(userID),
	})
	if err != nil {
		return nil, err
	}

	var commentIDStr, participantIDStr string
	if comment.ID.Valid {
		commentIDStr = uuid.UUID(comment.ID.Bytes).String()
	}
	if comment.ParticipantID.Valid {
		participantIDStr = uuid.UUID(comment.ParticipantID.Bytes).String()
	}

	return &model.Comment{
		ID:            model.CommentID(commentIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		UserID:        model.UserID(comment.UserID),
		Text:          comment.Text,
		CreatedAt:     comment.CreatedAt.Time,
		UpdatedAt:     comment.UpdatedAt.Time,
	}, nil
}

func (r *Repository) DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) error {
	reposqlc := sqlc_repository.New(r.conn)
	commentUUID, err := uuid.Parse(string(commentID))
	if err != nil {
		return err
	}

	return reposqlc.DeleteComment(ctx, &sqlc_repository.DeleteCommentParams{
		ID:     pgtype.UUID{Bytes: commentUUID, Valid: true},
		UserID: int64(userID),
	})
}
