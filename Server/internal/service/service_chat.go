package service

import (
	"context"
	"errors"
	"log"

	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

func chatAllowed(status model.ContestStatus) bool {
	return status == model.ContestStatusRegistration || status == model.ContestStatusVoting || status == model.ContestStatusFinished
}

func (s *TopPetService) CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string) (*model.ChatMessage, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	if len(text) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
	}

	// Check contest exists and status allows chat
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !chatAllowed(contest.Status) {
		return nil, errors.New("chat is not available for this contest stage")
	}

	message, err := s.repository.CreateChatMessage(ctx, contestID, userID, text, false)
	if err != nil {
		return nil, err
	}

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

func (s *TopPetService) ListChatMessages(ctx context.Context, contestID model.ContestID, limit, offset int) ([]*model.ChatMessage, int64, error) {
	log.Printf("[Service] ListChatMessages: contestID=%s, limit=%d, offset=%d", contestID, limit, offset)
	
	if limit <= 0 {
		log.Printf("[Service] ListChatMessages: limit <= 0, setting to 50")
		limit = 50
	}
	if limit > 100 {
		log.Printf("[Service] ListChatMessages: limit > 100, setting to 100")
		limit = 100
	}

	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		log.Printf("[Service] ListChatMessages: ERROR - Failed to get contest: %v", err)
		return nil, 0, err
	}
	if !chatAllowed(contest.Status) {
		return nil, 0, errors.New("chat is not available for this contest stage")
	}

	log.Printf("[Service] ListChatMessages: Calling repository.ListChatMessages...")
	messages, total, err := s.repository.ListChatMessages(ctx, contestID, limit, offset)
	if err != nil {
		log.Printf("[Service] ListChatMessages: ERROR - Repository returned error: %v", err)
		return nil, 0, err
	}
	
	log.Printf("[Service] ListChatMessages: Repository returned %d messages, total: %d", len(messages), total)
	return messages, total, nil
}

func (s *TopPetService) UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	if len(text) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
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

func (s *TopPetService) DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) error {
	contestID, err := s.repository.DeleteChatMessage(ctx, messageID, userID)
	if err != nil {
		return err
	}

	if s.hub != nil {
		payload := wsapp.MessageDeletedPayload{
			Type:      wsapp.MessageTypeMessageDeleted,
			ContestID: contestID,
			MessageID: messageID,
		}
		_ = s.hub.BroadcastContestMessage(contestID, payload)
	}

	return nil
}
