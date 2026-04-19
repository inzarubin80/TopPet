package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	wsapp "toppet/server/internal/app/ws"
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

	var parentComment *model.Comment
	if parentID != nil && *parentID != "" {
		var err error
		parentComment, err = s.repository.GetComment(ctx, *parentID)
		if err != nil {
			return nil, err
		}
		if parentComment.ParticipantID != participantID {
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
	s.pushParticipantWorkChatNotifications(ctx, participant, contest, comment, parentComment)
	s.broadcastParticipantUpdated(ctx, participantID)
	if s.hub != nil {
		payload := wsapp.ParticipantCommentCreatedPayload{
			Type:      wsapp.MessageTypeParticipantCommentCreated,
			ContestID: participant.ContestID,
			Comment:   comment,
		}
		_ = s.hub.BroadcastContestMessage(participant.ContestID, payload)
	}
	return comment, nil
}

func entryTitleForNotification(p *model.Participant) string {
	if p == nil {
		return "Ваша работа"
	}
	entry := strings.TrimSpace(p.EntryTitle)
	if entry == "" {
		entry = strings.TrimSpace(p.PetName)
	}
	if entry == "" {
		return "Ваша работа"
	}
	return entry
}

func (s *TopPetService) pushParticipantWorkChatNotifications(ctx context.Context, participant *model.Participant, contest *model.Contest, comment *model.Comment, parent *model.Comment) {
	if s == nil || comment == nil || participant == nil || contest == nil {
		return
	}
	preview := notificationMessagePreview(comment.Text, comment.ImageURL)
	authorName := strings.TrimSpace(comment.UserName)
	if authorName == "" {
		authorName = fmt.Sprintf("Пользователь %d", comment.UserID)
	}
	basePayload := map[string]any{
		"contest_id":       participant.ContestID,
		"contest_title":    contest.Title,
		"participant_id":   participant.ID,
		"entry_title":      entryTitleForNotification(participant),
		"comment_id":       comment.ID,
		"author_name":      authorName,
		"message_preview":  preview,
	}

	if parent != nil && parent.UserID != comment.UserID {
		_, _ = s.CreateAndPushUserNotification(ctx, parent.UserID, model.NotificationKindParticipantWorkChatReply, basePayload)
	}

	ownerID := participant.UserID
	if ownerID == comment.UserID {
		return
	}
	if parent != nil && parent.UserID == ownerID {
		return
	}
	_, _ = s.CreateAndPushUserNotification(ctx, ownerID, model.NotificationKindParticipantWorkChatMessage, basePayload)
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
	contestID, pid, score, err := s.repository.UpsertCommentVote(ctx, commentID, userID, value)
	if err != nil {
		return err
	}
	if s.hub != nil {
		payload := wsapp.ParticipantCommentVoteUpdatedPayload{
			Type:          wsapp.MessageTypeParticipantCommentVoteUpdated,
			ContestID:     contestID,
			ParticipantID: pid,
			CommentID:     commentID,
			Score:         score,
			VoterUserID:   userID,
			VoterValue:    value,
		}
		_ = s.hub.BroadcastContestMessage(contestID, payload)
	}
	return nil
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

	comment, err := s.repository.GetComment(ctx, commentID)
	if err != nil {
		return nil, err
	}
	if comment.UserID != userID {
		return nil, fmt.Errorf("only comment author can update comment: %w", model.ErrForbidden)
	}

	participant, err := s.repository.GetParticipant(ctx, comment.ParticipantID)
	if err != nil {
		return nil, err
	}
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}

	updated, err := s.repository.UpdateComment(ctx, commentID, userID, text)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("only comment author can update comment: %w", model.ErrForbidden)
		}
		return nil, err
	}
	if u, errU := s.repository.GetUser(ctx, userID); errU == nil && u != nil {
		updated.IsStaffComment = contest.CreatedByUserID == userID || model.IsGlobalContestManagerRole(u.Role)
	}
	if s.hub != nil {
		payload := wsapp.ParticipantCommentUpdatedPayload{
			Type:      wsapp.MessageTypeParticipantCommentUpdated,
			ContestID: participant.ContestID,
			Comment:   updated,
		}
		_ = s.hub.BroadcastContestMessage(participant.ContestID, payload)
	}
	return updated, nil
}

func (s *TopPetService) DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) ([]model.CommentID, error) {
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
		if !s.userCanManageContest(ctx, contest, userID) {
			return nil, fmt.Errorf("only comment author or contest organizer can delete comment: %w", model.ErrForbidden)
		}
	}

	contestID := participant.ContestID
	participantID := comment.ParticipantID
	deletedIDs, err := s.repository.DeleteComment(ctx, commentID, userID)
	if err != nil {
		return nil, err
	}
	if s.hub != nil {
		for _, cid := range deletedIDs {
			payload := wsapp.ParticipantCommentDeletedPayload{
				Type:          wsapp.MessageTypeParticipantCommentDeleted,
				ContestID:     contestID,
				ParticipantID: participantID,
				CommentID:     cid,
			}
			_ = s.hub.BroadcastContestMessage(contestID, payload)
		}
	}
	s.broadcastParticipantUpdated(ctx, participantID)
	return deletedIDs, nil
}
