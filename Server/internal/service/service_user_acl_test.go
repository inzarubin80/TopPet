package service

import (
	"context"
	"errors"
	"testing"

	"toppet/server/internal/model"
)

func TestTopPetService_UserCanManageContest(t *testing.T) {
	ctx := context.Background()
	contest := &model.Contest{
		ID:              "c1",
		CreatedByUserID: 10,
	}

	tests := []struct {
		name          string
		userID        model.UserID
		getUserRoleFn func(ctx context.Context, userID model.UserID) (string, error)
		want          bool
	}{
		{
			name:   "author_always_true_even_if_role_is_user",
			userID: 10,
			getUserRoleFn: func(ctx context.Context, userID model.UserID) (string, error) {
				return model.UserRoleUser, nil
			},
			want: true,
		},
		{
			name:   "contest_admin_who_is_also_author",
			userID: 10,
			getUserRoleFn: func(ctx context.Context, userID model.UserID) (string, error) {
				return model.UserRoleContestAdmin, nil
			},
			want: true,
		},
		{
			name:   "contest_admin_not_author",
			userID: 99,
			getUserRoleFn: func(ctx context.Context, userID model.UserID) (string, error) {
				if userID == 99 {
					return model.UserRoleContestAdmin, nil
				}
				return model.UserRoleUser, nil
			},
			want: true,
		},
		{
			name:   "system_admin_not_author",
			userID: 88,
			getUserRoleFn: func(ctx context.Context, userID model.UserID) (string, error) {
				return model.UserRoleSystemAdmin, nil
			},
			want: true,
		},
		{
			name:   "plain_user_not_author",
			userID: 42,
			getUserRoleFn: func(ctx context.Context, userID model.UserID) (string, error) {
				return model.UserRoleUser, nil
			},
			want: false,
		},
		{
			name:   "get_role_error_denies_non_author",
			userID: 42,
			getUserRoleFn: func(ctx context.Context, userID model.UserID) (string, error) {
				return "", errors.New("db down")
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &TopPetService{
				repository: &mockRepository{getUserRoleFunc: tt.getUserRoleFn},
			}
			if got := svc.UserCanManageContest(ctx, contest, tt.userID); got != tt.want {
				t.Fatalf("UserCanManageContest(...) = %v, want %v", got, tt.want)
			}
		})
	}
}
