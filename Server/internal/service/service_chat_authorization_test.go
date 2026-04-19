package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"toppet/server/internal/model"
)

func TestUpdateChatMessage_NonAuthorGetsForbidden(t *testing.T) {
	msgID := model.ChatMessageID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
	svc := &TopPetService{
		repository: &mockRepository{
			getChatMessageFunc: func(ctx context.Context, id model.ChatMessageID) (*model.ChatMessage, error) {
				if id != msgID {
					return nil, model.ErrorNotFound
				}
				return &model.ChatMessage{
					ID:        msgID,
					UserID:    10,
					IsSystem:  false,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}, nil
			},
		},
	}
	_, err := svc.UpdateChatMessage(context.Background(), msgID, 99, "hello")
	if !errors.Is(err, model.ErrForbidden) {
		t.Fatalf("UpdateChatMessage: want ErrForbidden, got %v", err)
	}
}

func TestDeleteChatMessage_NonAuthorGetsForbidden(t *testing.T) {
	msgID := model.ChatMessageID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
	svc := &TopPetService{
		repository: &mockRepository{
			getChatMessageFunc: func(ctx context.Context, id model.ChatMessageID) (*model.ChatMessage, error) {
				if id != msgID {
					return nil, model.ErrorNotFound
				}
				return &model.ChatMessage{
					ID:        msgID,
					UserID:    10,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}, nil
			},
		},
	}
	_, _, err := svc.DeleteChatMessage(context.Background(), msgID, 99)
	if !errors.Is(err, model.ErrForbidden) {
		t.Fatalf("DeleteChatMessage: want ErrForbidden, got %v", err)
	}
}

func TestUpdateChatMessage_SystemMessageGetsBadRequest(t *testing.T) {
	msgID := model.ChatMessageID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
	svc := &TopPetService{
		repository: &mockRepository{
			getChatMessageFunc: func(ctx context.Context, id model.ChatMessageID) (*model.ChatMessage, error) {
				return &model.ChatMessage{
					ID:        msgID,
					UserID:    10,
					IsSystem:  true,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}, nil
			},
		},
	}
	_, err := svc.UpdateChatMessage(context.Background(), msgID, 10, "hello")
	if !errors.Is(err, model.ErrBadRequest) {
		t.Fatalf("UpdateChatMessage system: want ErrBadRequest, got %v", err)
	}
}
