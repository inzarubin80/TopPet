package service

import (
	"context"
	"encoding/json"
	"time"

	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

const defaultNotificationListLimit = 50
const maxNotificationListLimit = 100

// CreateAndPushUserNotification сохраняет уведомление и рассылает по персональному WebSocket (все вкладки пользователя).
func (s *TopPetService) CreateAndPushUserNotification(ctx context.Context, userID model.UserID, kind string, payload map[string]any) (*model.UserNotification, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	n, err := s.repository.InsertUserNotification(ctx, userID, kind, json.RawMessage(raw))
	if err != nil {
		return nil, err
	}
	if s.userNotificationHub != nil {
		env := wsapp.UserNotificationEnvelope{
			Type:         wsapp.MessageTypeUserNotification,
			Notification: n,
		}
		_ = s.userNotificationHub.SendToUser(userID, env)
	}
	return n, nil
}

// CountUnreadUserNotifications возвращает число непрочитанных уведомлений.
func (s *TopPetService) CountUnreadUserNotifications(ctx context.Context, userID model.UserID) (int64, error) {
	return s.repository.CountUnreadUserNotifications(ctx, userID)
}

// ListUserNotifications возвращает страницу уведомлений и число непрочитанных (на момент запроса).
func (s *TopPetService) ListUserNotifications(ctx context.Context, userID model.UserID, limit int32, cursorCreatedAt *time.Time, cursorID *model.UserNotificationID) ([]*model.UserNotification, int64, error) {
	if limit <= 0 {
		limit = defaultNotificationListLimit
	}
	if limit > maxNotificationListLimit {
		limit = maxNotificationListLimit
	}
	unread, err := s.repository.CountUnreadUserNotifications(ctx, userID)
	if err != nil {
		return nil, 0, err
	}
	items, err := s.repository.ListUserNotificationsForUser(ctx, userID, limit, cursorCreatedAt, cursorID)
	if err != nil {
		return nil, 0, err
	}
	return items, unread, nil
}

// MarkUserNotificationRead помечает одно уведомление прочитанным.
func (s *TopPetService) MarkUserNotificationRead(ctx context.Context, ownerUserID model.UserID, id model.UserNotificationID) (*model.UserNotification, error) {
	return s.repository.MarkUserNotificationReadByOwner(ctx, id, ownerUserID)
}

// MarkAllUserNotificationsRead помечает все уведомления пользователя прочитанными.
func (s *TopPetService) MarkAllUserNotificationsRead(ctx context.Context, userID model.UserID) error {
	return s.repository.MarkAllUserNotificationsRead(ctx, userID)
}
