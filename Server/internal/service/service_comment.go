package service

import (
	"context"
	"errors"

	"toppet/server/internal/model"
)

func commentsAllowed(status model.ContestStatus) bool {
	return status == model.ContestStatusRegistration || status == model.ContestStatusVoting
}

func (s *TopPetService) CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string) (*model.Comment, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	if len(text) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
	}

	// Check participant exists
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if !commentsAllowed(contest.Status) {
		return nil, errors.New("comments are only allowed during registration or voting")
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

	participant, err := s.repository.GetParticipant(ctx, comment.ParticipantID)
	if err != nil {
		return nil, err
	}
	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if !commentsAllowed(contest.Status) {
		return nil, errors.New("comments are only allowed during registration or voting")
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

	participant, err := s.repository.GetParticipant(ctx, comment.ParticipantID)
	if err != nil {
		return err
	}
	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		return err
	}
	if !commentsAllowed(contest.Status) {
		return errors.New("comments are only allowed during registration or voting")
	}

	if comment.UserID != userID {
		if contest.CreatedByUserID != userID {
			return errors.New("only comment author or contest owner can delete comment")
		}
	}

	return s.repository.DeleteComment(ctx, commentID, userID)
}
