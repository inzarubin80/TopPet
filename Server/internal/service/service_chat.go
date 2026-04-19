package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"unicode/utf8"

	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

func chatAllowed(status model.ContestStatus) bool {
	return status == model.ContestStatusPublication ||
		status == model.ContestStatusRegistration ||
		status == model.ContestStatusVoting ||
		status == model.ContestStatusFinished
}

// EnsureContestChatImageUploadAllowed — проверка перед загрузкой картинки для сообщения чата.
func (s *TopPetService) EnsureContestChatImageUploadAllowed(ctx context.Context, contestID model.ContestID, userID model.UserID) error {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return err
	}
	if !chatAllowed(contest.Status) {
		return errors.New("chat is not available for this contest stage")
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

func submissionRejectionChatText(p *model.Participant, comment string) string {
	label := strings.TrimSpace(p.EntryTitle)
	if label == "" {
		label = strings.TrimSpace(p.PetName)
	}
	if label == "" {
		return comment
	}
	prefix := "Заявка «" + label + "» отклонена.\n\n"
	combined := prefix + comment
	if utf8.RuneCountInString(combined) > maxSubmissionCommentRunes {
		return comment
	}
	return combined
}

// postSubmissionRejectionToContestChat публикует в общий чат конкурса тот же текст, что сохранён в submission_comment (с коротким контекстом по работе).
func (s *TopPetService) postSubmissionRejectionToContestChat(ctx context.Context, contest *model.Contest, participant *model.Participant, actorID model.UserID, comment string) {
	if contest == nil || participant == nil {
		return
	}
	comment = strings.TrimSpace(comment)
	if comment == "" {
		return
	}
	if !chatAllowed(contest.Status) {
		log.Printf("[Moderation] skip posting rejection to chat: contest %s status %s", participant.ContestID, contest.Status)
		return
	}
	text := submissionRejectionChatText(participant, comment)
	if _, err := s.CreateChatMessage(ctx, participant.ContestID, actorID, text, nil, ""); err != nil {
		log.Printf("[Moderation] failed to post rejection to contest chat: %v", err)
	}
}

func (s *TopPetService) CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string, parentID *model.ChatMessageID, imageURL string) (*model.ChatMessage, error) {
	t := strings.TrimSpace(text)
	img := strings.TrimSpace(imageURL)
	if t == "" && img == "" {
		return nil, errors.New("text or image is required")
	}

	if utf8.RuneCountInString(t) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
	}

	// Check contest exists and status allows chat
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !chatAllowed(contest.Status) {
		return nil, errors.New("chat is not available for this contest stage")
	}

	blocked, err := s.repository.IsUserBlocked(ctx, userID)
	if err != nil {
		return nil, err
	}
	if blocked {
		return nil, model.ErrorForbidden
	}

	message, err := s.repository.CreateChatMessage(ctx, contestID, userID, t, false, parentID, img)
	if err != nil {
		return nil, err
	}

	s.pushContestChatReplyNotification(ctx, contest, message, parentID)

	// Broadcast to all subscribers
	if s.hub != nil {
		payload := wsapp.NewMessagePayload{
			Type:      wsapp.MessageTypeChatMessage,
			ContestID: contestID,
			Message:   message,
		}
		_ = s.hub.BroadcastContestMessage(contestID, payload)
	}

	return message, nil
}

func (s *TopPetService) pushContestChatReplyNotification(ctx context.Context, contest *model.Contest, message *model.ChatMessage, parentID *model.ChatMessageID) {
	if s == nil || contest == nil || message == nil || parentID == nil || *parentID == "" {
		return
	}
	parentMsg, err := s.repository.GetChatMessage(ctx, *parentID)
	if err != nil || parentMsg == nil {
		return
	}
	if parentMsg.IsSystem || parentMsg.UserID == message.UserID {
		return
	}
	preview := notificationMessagePreview(message.Text, message.ImageURL)
	authorName := strings.TrimSpace(message.UserName)
	if authorName == "" {
		authorName = fmt.Sprintf("Пользователь %d", message.UserID)
	}
	_, _ = s.CreateAndPushUserNotification(ctx, parentMsg.UserID, model.NotificationKindContestChatReply, map[string]any{
		"contest_id":        message.ContestID,
		"contest_title":     contest.Title,
		"message_id":        message.ID,
		"parent_message_id": parentMsg.ID,
		"author_name":       authorName,
		"message_preview":   preview,
	})
}

func (s *TopPetService) ListChatMessages(ctx context.Context, contestID model.ContestID, viewer *model.UserID, limit, offset int) ([]*model.ChatMessage, int64, error) {
	log.Printf("[Service] ListChatMessages: contestID=%s, limit=%d, offset=%d", contestID, limit, offset)

	if limit <= 0 {
		log.Printf("[Service] ListChatMessages: limit <= 0, setting to 50")
		limit = 50
	}
	if limit > 100 {
		log.Printf("[Service] ListChatMessages: limit > 100, setting to 100")
		limit = 100
	}

	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		log.Printf("[Service] ListChatMessages: ERROR - Failed to get contest: %v", err)
		return nil, 0, err
	}
	if !chatAllowed(contest.Status) {
		return nil, 0, errors.New("chat is not available for this contest stage")
	}

	log.Printf("[Service] ListChatMessages: Calling repository.ListChatMessages...")
	messages, total, err := s.repository.ListChatMessages(ctx, contestID, viewer, limit, offset)
	if err != nil {
		log.Printf("[Service] ListChatMessages: ERROR - Repository returned error: %v", err)
		return nil, 0, err
	}

	log.Printf("[Service] ListChatMessages: Repository returned %d messages, total: %d", len(messages), total)
	return messages, total, nil
}

func (s *TopPetService) VoteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, value int16) error {
	if value != -1 && value != 1 {
		return errors.New("value must be -1 or 1")
	}
	contestID, score, err := s.repository.UpsertChatMessageVote(ctx, messageID, userID, value)
	if err != nil {
		return err
	}
	if s.hub != nil {
		payload := wsapp.ChatMessageVoteUpdatedPayload{
			Type:        wsapp.MessageTypeChatMessageVoteUpdated,
			ContestID:   contestID,
			MessageID:   messageID,
			Score:       score,
			VoterUserID: userID,
			VoterValue:  value,
		}
		_ = s.hub.BroadcastContestMessage(contestID, payload)
	}
	return nil
}

func (s *TopPetService) UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	if utf8.RuneCountInString(text) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
	}

	existing, err := s.repository.GetChatMessage(ctx, messageID)
	if err != nil {
		return nil, err
	}
	if existing.UserID != userID {
		return nil, fmt.Errorf("only message author can update chat message: %w", model.ErrForbidden)
	}
	if existing.IsSystem {
		return nil, fmt.Errorf("%w: system messages cannot be edited", model.ErrBadRequest)
	}

	message, err := s.repository.UpdateChatMessage(ctx, messageID, userID, text)
	if err != nil {
		return nil, err
	}

	// Broadcast update
	if s.hub != nil {
		payload := wsapp.MessageUpdatedPayload{
			Type:      wsapp.MessageTypeMessageUpdated,
			ContestID: message.ContestID,
			Message:   message,
		}
		_ = s.hub.BroadcastContestMessage(message.ContestID, payload)
	}

	return message, nil
}

func (s *TopPetService) DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) (model.ContestID, []model.ChatMessageID, error) {
	existing, err := s.repository.GetChatMessage(ctx, messageID)
	if err != nil {
		return "", nil, err
	}
	if existing.UserID != userID {
		return "", nil, fmt.Errorf("only message author can delete chat message: %w", model.ErrForbidden)
	}
	if existing.IsSystem {
		return "", nil, fmt.Errorf("%w: system messages cannot be deleted", model.ErrBadRequest)
	}

	contestID, deletedIDs, err := s.repository.DeleteChatMessage(ctx, messageID, userID)
	if err != nil {
		return "", nil, err
	}

	if s.hub != nil {
		for _, mid := range deletedIDs {
			payload := wsapp.MessageDeletedPayload{
				Type:      wsapp.MessageTypeMessageDeleted,
				ContestID: contestID,
				MessageID: mid,
			}
			_ = s.hub.BroadcastContestMessage(contestID, payload)
		}
	}

	return contestID, deletedIDs, nil
}
