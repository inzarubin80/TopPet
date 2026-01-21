package service

import (
	"context"
	"errors"

	"toppet/server/internal/model"
)

func (s *TopPetService) CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string) (*model.Comment, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	if len(text) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
	}

	// Check participant exists
	_, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	return s.repository.CreateComment(ctx, participantID, userID, text)
}

func (s *TopPetService) ListComments(ctx context.Context, participantID model.ParticipantID, limit, offset int) ([]*model.Comment, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	return s.repository.ListCommentsByParticipant(ctx, participantID, limit, offset)
}

func (s *TopPetService) UpdateComment(ctx context.Context, commentID model.CommentID, userID model.UserID, text string) (*model.Comment, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	if len(text) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
	}

	// Check comment exists and belongs to user
	comment, err := s.repository.GetComment(ctx, commentID)
	if err != nil {
		return nil, err
	}

	if comment.UserID != userID {
		return nil, errors.New("only comment author can update comment")
	}

	return s.repository.UpdateComment(ctx, commentID, userID, text)
}

func (s *TopPetService) DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) error {
	// Check comment exists and belongs to user
	comment, err := s.repository.GetComment(ctx, commentID)
	if err != nil {
		return err
	}

	if comment.UserID != userID {
		return errors.New("only comment author can delete comment")
	}

	return s.repository.DeleteComment(ctx, commentID, userID)
}
