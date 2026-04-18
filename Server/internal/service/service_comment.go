package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"toppet/server/internal/model"
)

// EnsureParticipantCommentImageUploadAllowed — проверка перед загрузкой картинки для комментария к работе.
func (s *TopPetService) EnsureParticipantCommentImageUploadAllowed(ctx context.Context, participantID model.ParticipantID, userID model.UserID) error {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return err
	}
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return err
	}
	if !s.participantVisible(ctx, participant, contest, &userID) {
		return fmt.Errorf("%w", model.ErrorNotFound)
	}
	blocked, err := s.repository.IsUserBlocked(ctx, userID)
	if err != nil {
		return err
	}
	if blocked {
		return model.ErrorForbidden
	}
	return nil
}

func (s *TopPetService) CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string, parentID *model.CommentID, imageURL string) (*model.Comment, error) {
	t := strings.TrimSpace(text)
	img := strings.TrimSpace(imageURL)
	if t == "" && img == "" {
		return nil, errors.New("text or image is required")
	}

	if len(t) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
	}

	// Check participant exists
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if !s.participantVisible(ctx, participant, contest, &userID) {
		return nil, fmt.Errorf("%w", model.ErrorNotFound)
	}

	if parentID != nil && *parentID != "" {
		parent, err := s.repository.GetComment(ctx, *parentID)
		if err != nil {
			return nil, err
		}
		if parent.ParticipantID != participantID {
			return nil, errors.New("parent comment belongs to another participant")
		}
	}

	comment, err := s.repository.CreateComment(ctx, participantID, userID, t, parentID, img)
	if err != nil {
		return nil, err
	}
	if u, errU := s.repository.GetUser(ctx, userID); errU == nil && u != nil {
		comment.IsStaffComment = contest.CreatedByUserID == userID || model.IsGlobalContestManagerRole(u.Role)
	}
	s.broadcastParticipantUpdated(ctx, participantID)
	return comment, nil
}

func (s *TopPetService) ListComments(ctx context.Context, participantID model.ParticipantID, limit, offset int, viewer *model.UserID) ([]*model.Comment, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, 0, err
	}
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return nil, 0, err
	}
	if !s.participantVisible(ctx, participant, contest, viewer) {
		return nil, 0, fmt.Errorf("%w", model.ErrorNotFound)
	}

	comments, total, err := s.repository.ListCommentsByParticipant(ctx, participantID, viewer, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	return comments, total, nil
}

func (s *TopPetService) VoteComment(ctx context.Context, commentID model.CommentID, userID model.UserID, value int16) error {
	if value != -1 && value != 1 {
		return errors.New("value must be -1 or 1")
	}
	comment, err := s.repository.GetComment(ctx, commentID)
	if err != nil {
		return err
	}
	participant, err := s.repository.GetParticipant(ctx, comment.ParticipantID)
	if err != nil {
		return err
	}
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return err
	}
	if !s.participantVisible(ctx, participant, contest, &userID) {
		return fmt.Errorf("%w", model.ErrorNotFound)
	}
	return s.repository.UpsertCommentVote(ctx, commentID, userID, value)
}

// MarkParticipantStaffCommentsRead — владелец заявки отмечает комментарии организатора просмотренными (колокольчик).
func (s *TopPetService) MarkParticipantStaffCommentsRead(ctx context.Context, participantID model.ParticipantID, userID model.UserID) error {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return err
	}
	if participant.UserID != userID {
		return model.ErrorForbidden
	}
	return s.repository.UpdateParticipantOwnerStaffCommentReadAt(ctx, participantID, userID)
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
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if comment.UserID != userID {
		return nil, errors.New("only comment author can update comment")
	}

	updated, err := s.repository.UpdateComment(ctx, commentID, userID, text)
	if err != nil {
		return nil, err
	}
	if u, errU := s.repository.GetUser(ctx, userID); errU == nil && u != nil {
		updated.IsStaffComment = contest.CreatedByUserID == userID || model.IsGlobalContestManagerRole(u.Role)
	}
	return updated, nil
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
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return err
	}
	if comment.UserID != userID {
		if !s.userCanManageContest(ctx, contest, userID) {
			return errors.New("only comment author or contest owner can delete comment")
		}
	}

	if err := s.repository.DeleteComment(ctx, commentID, userID); err != nil {
		return err
	}
	s.broadcastParticipantUpdated(ctx, comment.ParticipantID)
	return nil
}
