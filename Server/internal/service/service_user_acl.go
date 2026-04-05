package service

import (
	"context"

	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/model"
)

func (s *TopPetService) userCanManageContest(ctx context.Context, contest *model.Contest, userID model.UserID) bool {
	if contest == nil {
		return false
	}
	if contest.CreatedByUserID == userID {
		return true
	}
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()
	role, err := s.repository.GetUserRole(dbCtx, userID)
	if err != nil {
		return false
	}
	return model.IsGlobalContestManagerRole(role)
}

// UserCanManageContest — создатель конкурса или глобальные роли contest_admin / system_admin.
func (s *TopPetService) UserCanManageContest(ctx context.Context, contest *model.Contest, userID model.UserID) bool {
	return s.userCanManageContest(ctx, contest, userID)
}

// GetUserRole — роль пользователя из БД (для списка конкурсов и пр.).
func (s *TopPetService) GetUserRole(ctx context.Context, userID model.UserID) (string, error) {
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()
	return s.repository.GetUserRole(dbCtx, userID)
}

func (s *TopPetService) requireSystemAdmin(ctx context.Context, userID model.UserID) error {
	role, err := s.repository.GetUserRole(ctx, userID)
	if err != nil {
		return err
	}
	if role != model.UserRoleSystemAdmin {
		return model.ErrorForbidden
	}
	return nil
}
