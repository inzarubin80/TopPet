package service

import (
	"context"

	"toppet/server/internal/model"
)

// ListStaffCommentNotifications возвращает заявки текущего пользователя (как владельца), где есть
// непрочитанные комментарии от организатора конкурса или администраторов системы.
func (s *TopPetService) ListStaffCommentNotifications(ctx context.Context, userID model.UserID) ([]*model.StaffCommentNotification, int64, error) {
	items, err := s.repository.ListStaffCommentNotificationsForUser(ctx, userID)
	if err != nil {
		return nil, 0, err
	}
	var total int64
	for _, it := range items {
		total += it.UnreadCount
	}
	return items, total, nil
}
