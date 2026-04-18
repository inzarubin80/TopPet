package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (r *Repository) CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string, parentID *model.CommentID) (*model.Comment, error) {
	reposqlc := sqlc_repository.New(r.conn)
	commentUUID := uuid.New()
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	parentUUID := pgtype.UUID{}
	if parentID != nil && *parentID != "" {
		parsedParentID, parseErr := uuid.Parse(string(*parentID))
		if parseErr != nil {
			return nil, parseErr
		}
		parentUUID = pgtype.UUID{Bytes: parsedParentID, Valid: true}
	}

	comment, err := reposqlc.CreateComment(ctx, &sqlc_repository.CreateCommentParams{
		ID:            pgtype.UUID{Bytes: commentUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		UserID:        int64(userID),
		Text:          text,
		ParentID:      parentUUID,
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

	user, err := r.GetUser(ctx, model.UserID(comment.UserID))
	userName := ""
	userAvatarURL := ""
	if err == nil && user != nil {
		userName = user.Name
		userAvatarURL = userAvatarURLFromUser(user)
	} else {
		userName = fmt.Sprintf("Пользователь %d", comment.UserID)
	}

	var parentCommentID *model.CommentID
	if comment.ParentID.Valid {
		parentIDVal := model.CommentID(uuid.UUID(comment.ParentID.Bytes).String())
		parentCommentID = &parentIDVal
	}

	return &model.Comment{
		ID:            model.CommentID(commentIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		ParentID:      parentCommentID,
		UserID:        model.UserID(comment.UserID),
		UserName:      userName,
		UserAvatarURL: userAvatarURL,
		Text:          comment.Text,
		Score:         0,
		UserVote:      0,
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

	user, err := r.GetUser(ctx, model.UserID(comment.UserID))
	userName := ""
	userAvatarURL := ""
	if err == nil && user != nil {
		userName = user.Name
		userAvatarURL = userAvatarURLFromUser(user)
	} else {
		userName = fmt.Sprintf("Пользователь %d", comment.UserID)
	}

	var parentCommentID *model.CommentID
	if comment.ParentID.Valid {
		parentIDVal := model.CommentID(uuid.UUID(comment.ParentID.Bytes).String())
		parentCommentID = &parentIDVal
	}

	return &model.Comment{
		ID:            model.CommentID(commentIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		ParentID:      parentCommentID,
		UserID:        model.UserID(comment.UserID),
		UserName:      userName,
		UserAvatarURL: userAvatarURL,
		Text:          comment.Text,
		Score:         0,
		UserVote:      0,
		CreatedAt:     comment.CreatedAt.Time,
		UpdatedAt:     comment.UpdatedAt.Time,
	}, nil
}

func (r *Repository) ListCommentsByParticipant(ctx context.Context, participantID model.ParticipantID, viewer *model.UserID, limit, offset int) ([]*model.Comment, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)

	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, 0, err
	}

	var viewerUserID *int64
	if viewer != nil {
		v := int64(*viewer)
		viewerUserID = &v
	}

	comments, err := reposqlc.ListCommentsByParticipant(ctx, &sqlc_repository.ListCommentsByParticipantParams{
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		ViewerUserID:  viewerUserID,
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

		var parentCommentID *model.CommentID
		if c.ParentID.Valid {
			parentIDVal := model.CommentID(uuid.UUID(c.ParentID.Bytes).String())
			parentCommentID = &parentIDVal
		}

		result[i] = &model.Comment{
			ID:            model.CommentID(commentIDStr),
			ParticipantID: model.ParticipantID(participantIDStr),
			ParentID:      parentCommentID,
			UserID:        model.UserID(c.UserID),
			UserName:      c.UserName,
			UserAvatarURL: optionalUserAvatarURL(c.UserAvatarUrl),
			Text:          c.Text,
			Score:         c.Score,
			UserVote:      c.UserVote,
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

	var parentCommentID *model.CommentID
	if comment.ParentID.Valid {
		parentIDVal := model.CommentID(uuid.UUID(comment.ParentID.Bytes).String())
		parentCommentID = &parentIDVal
	}

	user, err := r.GetUser(ctx, model.UserID(comment.UserID))
	userName := ""
	userAvatarURL := ""
	if err == nil && user != nil {
		userName = user.Name
		userAvatarURL = userAvatarURLFromUser(user)
	} else {
		userName = fmt.Sprintf("Пользователь %d", comment.UserID)
	}

	return &model.Comment{
		ID:            model.CommentID(commentIDStr),
		ParticipantID: model.ParticipantID(participantIDStr),
		ParentID:      parentCommentID,
		UserID:        model.UserID(comment.UserID),
		UserName:      userName,
		UserAvatarURL: userAvatarURL,
		Text:          comment.Text,
		Score:         0,
		UserVote:      0,
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

	return reposqlc.DeleteComment(ctx, pgtype.UUID{Bytes: commentUUID, Valid: true})
}

func (r *Repository) UpsertCommentVote(ctx context.Context, commentID model.CommentID, userID model.UserID, value int16) error {
	reposqlc := sqlc_repository.New(r.conn)
	commentUUID, err := uuid.Parse(string(commentID))
	if err != nil {
		return err
	}

	_, err = reposqlc.UpsertCommentVote(ctx, &sqlc_repository.UpsertCommentVoteParams{
		CommentID: pgtype.UUID{Bytes: commentUUID, Valid: true},
		UserID:    int64(userID),
		Value:     value,
	})
	return err
}

func (r *Repository) UpdateParticipantOwnerStaffCommentReadAt(ctx context.Context, participantID model.ParticipantID, ownerUserID model.UserID) error {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return err
	}
	return reposqlc.UpdateParticipantOwnerStaffCommentReadAt(ctx, &sqlc_repository.UpdateParticipantOwnerStaffCommentReadAtParams{
		ID:     pgtype.UUID{Bytes: participantUUID, Valid: true},
		UserID: int64(ownerUserID),
	})
}

func (r *Repository) ListStaffCommentNotificationsForUser(ctx context.Context, userID model.UserID) ([]*model.StaffCommentNotification, error) {
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListStaffCommentNotificationsForUser(ctx, int64(userID))
	if err != nil {
		return nil, err
	}
	out := make([]*model.StaffCommentNotification, 0, len(rows))
	for _, row := range rows {
		var pid, cid string
		if row.ParticipantID.Valid {
			pid = uuid.UUID(row.ParticipantID.Bytes).String()
		}
		if row.ContestID.Valid {
			cid = uuid.UUID(row.ContestID.Bytes).String()
		}
		at := time.Time{}
		if row.LatestCommentAt.Valid {
			at = row.LatestCommentAt.Time
		}
		out = append(out, &model.StaffCommentNotification{
			ParticipantID:        model.ParticipantID(pid),
			ContestID:            model.ContestID(cid),
			ContestTitle:         row.ContestTitle,
			PetName:              row.PetName,
			UnreadCount:          row.UnreadCount,
			LatestCommentAt:      at,
			LatestCommentPreview: row.LatestCommentPreview,
		})
	}
	return out, nil
}
