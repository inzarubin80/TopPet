package service

import (
	"context"
	"errors"

	"toppet/server/internal/model"
)

func (s *TopPetService) CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string) (*model.ChatMessage, error) {
	if text == "" {
		return nil, errors.New("text is required")
	}

	if len(text) > 2000 {
		return nil, errors.New("text is too long (max 2000 characters)")
	}

	// Check contest exists
	_, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	message, err := s.repository.CreateChatMessage(ctx, contestID, userID, text, false)
	if err != nil {
		return nil, err
	}

	// Broadcast to all subscribers
	if s.hub != nil {
		_ = s.hub.BroadcastContestMessage(contestID, map[string]interface{}{
			"type":    "new_message",
			"contest_id": string(contestID),
			"message": message,
		})
	}

	return message, nil
}

func (s *TopPetService) ListChatMessages(ctx context.Context, contestID model.ContestID, limit, offset int) ([]*model.ChatMessage, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	return s.repository.ListChatMessages(ctx, contestID, limit, offset)
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
		_ = s.hub.BroadcastContestMessage(message.ContestID, map[string]interface{}{
			"type":    "message_updated",
			"contest_id": string(message.ContestID),
			"message": message,
		})
	}

	return message, nil
}

func (s *TopPetService) DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) error {
	return s.repository.DeleteChatMessage(ctx, messageID, userID)
}
