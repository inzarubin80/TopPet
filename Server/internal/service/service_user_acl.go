package service

import (
	"context"

	"toppet/server/internal/model"
)

func (s *TopPetService) userCanManageContest(ctx context.Context, contest *model.Contest, userID model.UserID) bool {
	if contest == nil {
		return false
	}
	if contest.CreatedByUserID == userID {
		return true
	}
	role, err := s.repository.GetUserRole(ctx, userID)
	if err != nil {
		return false
	}
	return role == model.UserRoleContestAdmin || role == model.UserRoleSystemAdmin
}

// UserCanManageContest — создатель конкурса или глобальные роли contest_admin / system_admin.
func (s *TopPetService) UserCanManageContest(ctx context.Context, contest *model.Contest, userID model.UserID) bool {
	return s.userCanManageContest(ctx, contest, userID)
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
