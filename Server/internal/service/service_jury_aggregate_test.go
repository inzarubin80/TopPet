package service

import (
	"context"
	"testing"

	"toppet/server/internal/model"
)

func TestTopPetService_shouldExposeJuryScoreTotal(t *testing.T) {
	ctx := context.Background()
	plainUser := model.UserID(42)
	authorID := model.UserID(10)

	tests := []struct {
		name       string
		contest    *model.Contest
		viewer     *model.UserID
		getRole    func(ctx context.Context, userID model.UserID) (string, error)
		wantExpose bool
	}{
		{
			name: "jury_disabled",
			contest: &model.Contest{
				ID:                "c1",
				CreatedByUserID:   authorID,
				JuryVotingEnabled: false,
				Status:            model.ContestStatusVoting,
			},
			viewer:     &plainUser,
			getRole:    func(ctx context.Context, userID model.UserID) (string, error) { return model.UserRoleUser, nil },
			wantExpose: false,
		},
		{
			name: "voting_plain_user",
			contest: &model.Contest{
				ID:                "c1",
				CreatedByUserID:   authorID,
				JuryVotingEnabled: true,
				Status:            model.ContestStatusVoting,
			},
			viewer:     &plainUser,
			getRole:    func(ctx context.Context, userID model.UserID) (string, error) { return model.UserRoleUser, nil },
			wantExpose: false,
		},
		{
			name: "voting_author",
			contest: &model.Contest{
				ID:                "c1",
				CreatedByUserID:   authorID,
				JuryVotingEnabled: true,
				Status:            model.ContestStatusVoting,
			},
			viewer:     &authorID,
			getRole:    func(ctx context.Context, userID model.UserID) (string, error) { return model.UserRoleUser, nil },
			wantExpose: true,
		},
		{
			name: "voting_contest_admin_not_author",
			contest: &model.Contest{
				ID:                "c1",
				CreatedByUserID:   authorID,
				JuryVotingEnabled: true,
				Status:            model.ContestStatusVoting,
			},
			viewer:     &plainUser,
			getRole:    func(ctx context.Context, userID model.UserID) (string, error) { return model.UserRoleContestAdmin, nil },
			wantExpose: true,
		},
		{
			name: "finished_plain_user",
			contest: &model.Contest{
				ID:                "c1",
				CreatedByUserID:   authorID,
				JuryVotingEnabled: true,
				Status:            model.ContestStatusFinished,
			},
			viewer:     &plainUser,
			getRole:    func(ctx context.Context, userID model.UserID) (string, error) { return model.UserRoleUser, nil },
			wantExpose: true,
		},
		{
			name: "finished_anonymous_viewer_nil",
			contest: &model.Contest{
				ID:                "c1",
				CreatedByUserID:   authorID,
				JuryVotingEnabled: true,
				Status:            model.ContestStatusFinished,
			},
			viewer:     nil,
			getRole:    nil,
			wantExpose: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &TopPetService{
				repository: &mockRepository{getUserRoleFunc: tt.getRole},
			}
			if got := svc.shouldExposeJuryScoreTotal(ctx, tt.contest, tt.viewer); got != tt.wantExpose {
				t.Fatalf("shouldExposeJuryScoreTotal(...) = %v, want %v", got, tt.wantExpose)
			}
		})
	}
}
