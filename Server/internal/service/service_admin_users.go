package service

import (
	"context"

	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/model"
)

// ListUsersForSystemAdmin возвращает страницу пользователей (только system_admin).
func (s *TopPetService) ListUsersForSystemAdmin(ctx context.Context, actorID model.UserID, limit, offset int) ([]*model.User, int64, error) {
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
	return items, total, nil
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
