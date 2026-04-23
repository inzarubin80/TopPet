package service

import (
	"context"
	"fmt"
	"strings"

	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/model"
)

// ListUsersForSystemAdmin возвращает страницу пользователей (только system_admin).
func (s *TopPetService) ListUsersForSystemAdmin(ctx context.Context, actorID model.UserID, limit, offset int) ([]*model.AdminUserListItem, int64, error) {
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	if err := s.requireSystemAdmin(dbCtx, actorID); err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	total, err := s.repository.CountUsers(dbCtx)
	if err != nil {
		return nil, 0, err
	}
	items, err := s.repository.ListUsersForAdmin(dbCtx, int32(limit), int32(offset))
	if err != nil {
		return nil, 0, err
	}
	out := make([]*model.AdminUserListItem, 0, len(items))
	for _, u := range items {
		online := s.userNotificationHub != nil && s.userNotificationHub.IsUserOnline(u.ID)
		out = append(out, &model.AdminUserListItem{User: u, Online: online})
	}
	return out, total, nil
}

// SetUserRoleBySystemAdmin выставляет роль пользователю (только system_admin).
func (s *TopPetService) SetUserRoleBySystemAdmin(ctx context.Context, actorID model.UserID, targetUserID model.UserID, role string) (*model.User, error) {
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	if err := s.requireSystemAdmin(dbCtx, actorID); err != nil {
		return nil, err
	}
	if !model.IsValidUserRole(role) {
		return nil, model.ErrInvalidUserRole
	}

	target, err := s.repository.GetUser(dbCtx, targetUserID)
	if err != nil {
		return nil, err
	}
	currentRole := target.Role
	if currentRole == "" {
		currentRole = model.UserRoleUser
	}

	if currentRole == model.UserRoleSystemAdmin && role != model.UserRoleSystemAdmin {
		n, err := s.repository.CountSystemAdmins(dbCtx)
		if err != nil {
			return nil, err
		}
		if n <= 1 {
			return nil, model.ErrLastSystemAdmin
		}
	}

	u, err := s.repository.UpdateUserRole(dbCtx, targetUserID, role)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// SetUserBlockedBySystemAdmin выставляет флаг блокировки (только system_admin).
func (s *TopPetService) SetUserBlockedBySystemAdmin(ctx context.Context, actorID model.UserID, targetUserID model.UserID, blocked bool) (*model.User, error) {
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	if err := s.requireSystemAdmin(dbCtx, actorID); err != nil {
		return nil, err
	}
	return s.repository.UpdateUserBlocked(dbCtx, targetUserID, blocked)
}

// PatchUserBySystemAdmin — смена роли и/или блокировки в одном запросе (только system_admin).
func (s *TopPetService) PatchUserBySystemAdmin(ctx context.Context, actorID model.UserID, targetUserID model.UserID, role *string, blocked *bool) (*model.User, error) {
	trimmed := ""
	if role != nil {
		trimmed = strings.TrimSpace(*role)
	}
	if trimmed == "" && blocked == nil {
		return nil, fmt.Errorf("%w: role or blocked required", model.ErrBadRequest)
	}
	var out *model.User
	var err error
	if trimmed != "" {
		out, err = s.SetUserRoleBySystemAdmin(ctx, actorID, targetUserID, trimmed)
		if err != nil {
			return nil, err
		}
	}
	if blocked != nil {
		out, err = s.SetUserBlockedBySystemAdmin(ctx, actorID, targetUserID, *blocked)
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}
