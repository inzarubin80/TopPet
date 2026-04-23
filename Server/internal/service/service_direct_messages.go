package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

const (
	defaultDirectListLimit = 50
	maxDirectListLimit     = 100
	maxDirectMessageRunes  = 2000
)

func normalizeDirectListLimit(limit int) int {
	if limit <= 0 {
		return defaultDirectListLimit
	}
	if limit > maxDirectListLimit {
		return maxDirectListLimit
	}
	return limit
}

func (s *TopPetService) EnsureDirectConversationWithUser(ctx context.Context, ownerUserID, peerUserID model.UserID) (*model.DirectConversation, error) {
	if ownerUserID == 0 || peerUserID == 0 {
		return nil, errors.New("invalid user id")
	}
	if ownerUserID == peerUserID {
		return nil, errors.New("cannot create conversation with self")
	}
	if _, err := s.repository.GetUser(ctx, peerUserID); err != nil {
		return nil, err
	}
	conv, err := s.repository.GetOrCreateDirectConversationByPair(ctx, ownerUserID, peerUserID)
	if err != nil {
		return nil, err
	}
	s.applyPeerOnline(conv)
	return conv, nil
}

func (s *TopPetService) applyPeerOnline(conv *model.DirectConversation) {
	if conv == nil || s.userNotificationHub == nil {
		return
	}
	conv.PeerUserOnline = s.userNotificationHub.IsUserOnline(conv.PeerUserID)
}

func (s *TopPetService) ListMyDirectConversations(ctx context.Context, userID model.UserID, limit, offset int) ([]*model.DirectConversation, int64, error) {
	limit = normalizeDirectListLimit(limit)
	if offset < 0 {
		offset = 0
	}
	items, total, err := s.repository.ListDirectConversationsByUser(ctx, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	for _, c := range items {
		s.applyPeerOnline(c)
	}
	return items, total, nil
}

// BroadcastDirectMessagePeerPresence рассылает peer_presence собеседникам и peer_presence_snapshot подключившемуся пользователю.
func (s *TopPetService) BroadcastDirectMessagePeerPresence(ctx context.Context, userID model.UserID, online bool) error {
	if s.userNotificationHub == nil {
		return nil
	}
	peerIDs, err := s.repository.ListDirectConversationPeerUserIDsByUser(ctx, userID)
	if err != nil {
		return err
	}
	payload := wsapp.PeerPresencePayload{
		Type:   wsapp.MessageTypePeerPresence,
		UserID: userID,
		Online: online,
	}
	for _, pid := range peerIDs {
		_ = s.userNotificationHub.SendToUser(pid, payload)
	}
	if online {
		onlinePeers := make([]model.UserID, 0, len(peerIDs))
		for _, pid := range peerIDs {
			if s.userNotificationHub.IsUserOnline(pid) {
				onlinePeers = append(onlinePeers, pid)
			}
		}
		snap := wsapp.PeerPresenceSnapshotPayload{
			Type:              wsapp.MessageTypePeerPresenceSnapshot,
			OnlinePeerUserIDs: onlinePeers,
		}
		_ = s.userNotificationHub.SendToUser(userID, snap)
	}
	return nil
}

func (s *TopPetService) ListDirectMessages(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID, limit, offset int) ([]*model.DirectMessage, int64, error) {
	limit = normalizeDirectListLimit(limit)
	if offset < 0 {
		offset = 0
	}
	if _, err := s.repository.GetDirectConversationForUser(ctx, conversationID, userID); err != nil {
		return nil, 0, err
	}
	return s.repository.ListDirectMessagesByConversation(ctx, conversationID, limit, offset)
}

func (s *TopPetService) CreateDirectMessage(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID, text string) (*model.DirectMessage, error) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return nil, errors.New("text is required")
	}
	if utf8.RuneCountInString(trimmed) > maxDirectMessageRunes {
		return nil, fmt.Errorf("text is too long (max %d characters)", maxDirectMessageRunes)
	}

	blocked, err := s.repository.IsUserBlocked(ctx, userID)
	if err != nil {
		return nil, err
	}
	if blocked {
		return nil, model.ErrorForbidden
	}

	conversation, err := s.repository.GetDirectConversationForUser(ctx, conversationID, userID)
	if err != nil {
		return nil, err
	}

	message, err := s.repository.CreateDirectMessage(ctx, conversationID, userID, trimmed)
	if err != nil {
		return nil, err
	}

	if s.userNotificationHub != nil && conversation != nil {
		payload := wsapp.DirectMessagePayload{
			Type:           wsapp.MessageTypeDirectMessage,
			ConversationID: conversationID,
			Message:        message,
		}
		_ = s.userNotificationHub.SendToUser(conversation.UserLowID, payload)
		_ = s.userNotificationHub.SendToUser(conversation.UserHighID, payload)
	}

	return message, nil
}

func (s *TopPetService) UpdateDirectMessage(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID, messageID model.DirectMessageID, text string) (*model.DirectMessage, error) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return nil, errors.New("text is required")
	}
	if utf8.RuneCountInString(trimmed) > maxDirectMessageRunes {
		return nil, fmt.Errorf("text is too long (max %d characters)", maxDirectMessageRunes)
	}
	conversation, err := s.repository.GetDirectConversationForUser(ctx, conversationID, userID)
	if err != nil {
		return nil, err
	}
	existing, err := s.repository.GetDirectMessageByID(ctx, messageID)
	if err != nil {
		return nil, err
	}
	if existing.ConversationID != conversationID {
		return nil, model.ErrorForbidden
	}
	if existing.SenderUserID != userID {
		return nil, model.ErrorForbidden
	}
	updated, err := s.repository.UpdateDirectMessageByID(ctx, messageID, trimmed)
	if err != nil {
		return nil, err
	}
	if s.userNotificationHub != nil && conversation != nil {
		payload := wsapp.DirectMessageUpdatedPayload{
			Type:           wsapp.MessageTypeDirectMessageUpdated,
			ConversationID: conversationID,
			Message:        updated,
		}
		_ = s.userNotificationHub.SendToUser(conversation.UserLowID, payload)
		_ = s.userNotificationHub.SendToUser(conversation.UserHighID, payload)
	}
	return updated, nil
}

func (s *TopPetService) DeleteDirectMessage(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID, messageID model.DirectMessageID) error {
	conversation, err := s.repository.GetDirectConversationForUser(ctx, conversationID, userID)
	if err != nil {
		return err
	}
	existing, err := s.repository.GetDirectMessageByID(ctx, messageID)
	if err != nil {
		return err
	}
	if existing.ConversationID != conversationID {
		return model.ErrorForbidden
	}
	if existing.SenderUserID != userID {
		return model.ErrorForbidden
	}
	_, err = s.repository.DeleteDirectMessageByID(ctx, messageID)
	if err != nil {
		return err
	}
	if s.userNotificationHub != nil && conversation != nil {
		payload := wsapp.DirectMessageDeletedPayload{
			Type:           wsapp.MessageTypeDirectMessageDeleted,
			ConversationID: conversationID,
			MessageID:      messageID,
		}
		_ = s.userNotificationHub.SendToUser(conversation.UserLowID, payload)
		_ = s.userNotificationHub.SendToUser(conversation.UserHighID, payload)
	}
	return nil
}

func (s *TopPetService) DeleteDirectConversation(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID) error {
	conversation, err := s.repository.GetDirectConversationForUser(ctx, conversationID, userID)
	if err != nil {
		return err
	}
	lowID, highID := conversation.UserLowID, conversation.UserHighID

	if err := s.repository.DeleteDirectConversationWithMessages(ctx, conversationID); err != nil {
		return err
	}

	if s.userNotificationHub != nil {
		payload := wsapp.DirectConversationDeletedPayload{
			Type:           wsapp.MessageTypeDirectConversationDeleted,
			ConversationID: conversationID,
		}
		_ = s.userNotificationHub.SendToUser(lowID, payload)
		_ = s.userNotificationHub.SendToUser(highID, payload)
	}
	return nil
}
