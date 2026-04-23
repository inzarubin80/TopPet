package service

import (
	"context"
	"errors"
	"testing"

	"toppet/server/internal/model"
)

func TestTopPetService_ListUsersForSystemAdmin_requiresSystemAdmin(t *testing.T) {
	ctx := context.Background()
	contestAdminRepo := &mockRepository{
		getUserRoleFunc: func(ctx context.Context, userID model.UserID) (string, error) {
			return model.UserRoleContestAdmin, nil
		},
	}
	svc := &TopPetService{repository: contestAdminRepo}
	_, _, err := svc.ListUsersForSystemAdmin(ctx, 1, 50, 0)
	if !errors.Is(err, model.ErrorForbidden) {
		t.Fatalf("contest_admin: want ErrorForbidden, got %v", err)
	}

	okRepo := &mockRepository{
		getUserRoleFunc: func(ctx context.Context, userID model.UserID) (string, error) {
			return model.UserRoleSystemAdmin, nil
		},
		listUsersForAdminFunc: func(ctx context.Context, limit, offset int32) ([]*model.User, error) {
			return []*model.User{{ID: 1, Name: "a", Role: model.UserRoleUser}}, nil
		},
		countUsersFunc: func(ctx context.Context) (int64, error) {
			return 1, nil
		},
	}
	svc2 := &TopPetService{repository: okRepo}
	items, total, err := svc2.ListUsersForSystemAdmin(ctx, 1, 50, 0)
	if err != nil {
		t.Fatalf("system_admin: unexpected err: %v", err)
	}
	if total != 1 || len(items) != 1 {
		t.Fatalf("system_admin: want total=1 len=1, got total=%d len=%d", total, len(items))
	}
	if items[0].User == nil || items[0].User.Name != "a" {
		t.Fatalf("system_admin: unexpected embedded user: %+v", items[0].User)
	}
	if items[0].Online {
		t.Fatalf("system_admin: want online=false without hub, got true")
	}
}

func TestTopPetService_SetUserRoleBySystemAdmin_requiresSystemAdmin(t *testing.T) {
	ctx := context.Background()
	contestAdminRepo := &mockRepository{
		getUserRoleFunc: func(ctx context.Context, userID model.UserID) (string, error) {
			return model.UserRoleContestAdmin, nil
		},
	}
	svc := &TopPetService{repository: contestAdminRepo}
	_, err := svc.SetUserRoleBySystemAdmin(ctx, 1, 2, model.UserRoleUser)
	if !errors.Is(err, model.ErrorForbidden) {
		t.Fatalf("contest_admin: want ErrorForbidden, got %v", err)
	}
}
