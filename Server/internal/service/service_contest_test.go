package service

import (
	"context"
	"errors"
	"testing"

	"toppet/server/internal/model"
)

// mockRepository мок для Repository
type mockRepository struct {
	createContestFunc      func(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
	getContestFunc         func(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
	updateContestFunc      func(ctx context.Context, contestID model.ContestID, title, description string) (*model.Contest, error)
	updateContestStatusFunc func(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error)
	deleteContestFunc      func(ctx context.Context, contestID model.ContestID) error
	listContestsFunc       func(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error)
	countVotesByContestFunc func(ctx context.Context, contestID model.ContestID) (int64, error)
	countVotesByContestsFunc func(ctx context.Context, contestIDs []model.ContestID) (map[model.ContestID]int64, error)
}

func (m *mockRepository) CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
	if m.createContestFunc != nil {
		return m.createContestFunc(ctx, userID, title, description)
	}
	return nil, nil
}

func (m *mockRepository) GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	if m.getContestFunc != nil {
		return m.getContestFunc(ctx, contestID)
	}
	return nil, nil
}

func (m *mockRepository) UpdateContest(ctx context.Context, contestID model.ContestID, title, description string) (*model.Contest, error) {
	if m.updateContestFunc != nil {
		return m.updateContestFunc(ctx, contestID, title, description)
	}
	return nil, nil
}

func (m *mockRepository) UpdateContestStatus(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error) {
	if m.updateContestStatusFunc != nil {
		return m.updateContestStatusFunc(ctx, contestID, status)
	}
	return nil, nil
}

func (m *mockRepository) DeleteContest(ctx context.Context, contestID model.ContestID) error {
	if m.deleteContestFunc != nil {
		return m.deleteContestFunc(ctx, contestID)
	}
	return nil
}

func (m *mockRepository) ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error) {
	if m.listContestsFunc != nil {
		return m.listContestsFunc(ctx, status, limit, offset)
	}
	return nil, 0, nil
}

func (m *mockRepository) CountVotesByContest(ctx context.Context, contestID model.ContestID) (int64, error) {
	if m.countVotesByContestFunc != nil {
		return m.countVotesByContestFunc(ctx, contestID)
	}
	return 0, nil
}

func (m *mockRepository) CountVotesByContests(ctx context.Context, contestIDs []model.ContestID) (map[model.ContestID]int64, error) {
	if m.countVotesByContestsFunc != nil {
		return m.countVotesByContestsFunc(ctx, contestIDs)
	}
	return make(map[model.ContestID]int64), nil
}

// Реализуем остальные методы интерфейса Repository (заглушки)
func (m *mockRepository) CreateUser(ctx context.Context, name string) (*model.User, error) { return nil, nil }
func (m *mockRepository) CreateUserFromProvider(ctx context.Context, userData *model.UserProfileFromProvider) (*model.User, error) { return nil, nil }
func (m *mockRepository) GetUser(ctx context.Context, userID model.UserID) (*model.User, error) { return nil, nil }
func (m *mockRepository) UpdateUserName(ctx context.Context, userID model.UserID, name string) (*model.User, error) { return nil, nil }
func (m *mockRepository) GetUserAuthProvidersByProviderUid(ctx context.Context, providerUID, provider string) (*model.UserAuthProvider, error) { return nil, nil }
func (m *mockRepository) AddUserAuthProviders(ctx context.Context, userData *model.UserProfileFromProvider, userID model.UserID) (*model.UserAuthProvider, error) { return nil, nil }
func (m *mockRepository) GetUserAuthProvidersByUserID(ctx context.Context, userID model.UserID) ([]*model.UserAuthProvider, error) { return nil, nil }
func (m *mockRepository) SetUserAvatarIfEmpty(ctx context.Context, userID model.UserID, avatarURL *string) error { return nil }
// ListContests, UpdateContest, UpdateContestStatus, DeleteContest реализованы ниже с поддержкой моков
func (m *mockRepository) CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, petName, petDescription string) (*model.Participant, error) { return nil, nil }
func (m *mockRepository) GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error) { return nil, nil }
func (m *mockRepository) GetParticipantByContestAndUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Participant, error) { return nil, nil }
func (m *mockRepository) ListParticipantsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Participant, error) { return nil, nil }
func (m *mockRepository) UpdateParticipant(ctx context.Context, participantID model.ParticipantID, petName, petDescription string) (*model.Participant, error) { return nil, nil }
func (m *mockRepository) DeleteParticipant(ctx context.Context, participantID model.ParticipantID) error { return nil }
func (m *mockRepository) AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, url string, thumbURL *string) (*model.Photo, error) { return nil, nil }
func (m *mockRepository) GetPhotosByParticipantID(ctx context.Context, participantID model.ParticipantID) ([]*model.Photo, error) { return nil, nil }
func (m *mockRepository) DeleteParticipantPhoto(ctx context.Context, participantID model.ParticipantID, photoID string) error { return nil }
func (m *mockRepository) UpdateParticipantPhotoOrder(ctx context.Context, participantID model.ParticipantID, photoIDs []string) error { return nil }
func (m *mockRepository) UpsertParticipantVideo(ctx context.Context, participantID model.ParticipantID, url string) (*model.Video, error) { return nil, nil }
func (m *mockRepository) GetVideoByParticipantID(ctx context.Context, participantID model.ParticipantID) (*model.Video, error) { return nil, nil }
func (m *mockRepository) DeleteParticipantVideo(ctx context.Context, participantID model.ParticipantID) error { return nil }
func (m *mockRepository) UpsertContestVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error) { return nil, nil }
func (m *mockRepository) GetContestVoteByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Vote, error) { return nil, nil }
func (m *mockRepository) DeleteContestVoteByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (model.ParticipantID, error) { return "", nil }
// CountVotesByContest, CountVotesByContests реализованы ниже с поддержкой моков
func (m *mockRepository) CountVotesByParticipant(ctx context.Context, participantID model.ParticipantID) (int64, error) { return 0, nil }
func (m *mockRepository) CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string) (*model.Comment, error) { return nil, nil }
func (m *mockRepository) GetComment(ctx context.Context, commentID model.CommentID) (*model.Comment, error) { return nil, nil }
func (m *mockRepository) ListCommentsByParticipant(ctx context.Context, participantID model.ParticipantID, limit, offset int) ([]*model.Comment, int64, error) { return nil, 0, nil }
func (m *mockRepository) UpdateComment(ctx context.Context, commentID model.CommentID, userID model.UserID, text string) (*model.Comment, error) { return nil, nil }
func (m *mockRepository) DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) error { return nil }
func (m *mockRepository) CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string, isSystem bool) (*model.ChatMessage, error) { return nil, nil }
func (m *mockRepository) ListChatMessages(ctx context.Context, contestID model.ContestID, limit, offset int) ([]*model.ChatMessage, int64, error) { return nil, 0, nil }
func (m *mockRepository) UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error) { return nil, nil }
func (m *mockRepository) DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) (model.ContestID, error) { return "", nil }
func (m *mockRepository) UpsertPhotoLike(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error) { return nil, nil }
func (m *mockRepository) DeletePhotoLike(ctx context.Context, photoID string, userID model.UserID) error { return nil }
func (m *mockRepository) GetPhotoLikeByUser(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error) { return nil, nil }
func (m *mockRepository) CountPhotoLikes(ctx context.Context, photoID string) (int64, error) { return 0, nil }
func (m *mockRepository) ListPhotoLikesByPhotos(ctx context.Context, photoIDs []string, userID model.UserID) (map[string]*model.PhotoLike, error) { return nil, nil }
// CountVotesByContests реализован выше с поддержкой моков

func TestTopPetService_CreateContest(t *testing.T) {
	tests := []struct {
		name        string
		userID      model.UserID
		title       string
		description string
		mockFunc    func(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
		wantErr     bool
		errMsg      string
	}{
		{
			name:        "successful creation",
			userID:      1,
			title:       "Test Contest",
			description: "Test Description",
			mockFunc: func(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
				return &model.Contest{
					ID:              "test-id",
					CreatedByUserID: userID,
					Title:           title,
					Description:     description,
					Status:          model.ContestStatusDraft,
				}, nil
			},
			wantErr: false,
		},
		{
			name:        "empty title",
			userID:      1,
			title:       "",
			description: "Test Description",
			mockFunc:    nil,
			wantErr:     true,
			errMsg:      "title is required",
		},
		{
			name:        "repository error",
			userID:      1,
			title:       "Test Contest",
			description: "Test Description",
			mockFunc: func(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
				return nil, errors.New("database error")
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockRepository{
				createContestFunc: tt.mockFunc,
			}
			service := &TopPetService{
				repository: mockRepo,
			}

			ctx := context.Background()
			contest, err := service.CreateContest(ctx, tt.userID, tt.title, tt.description)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error, got nil")
				} else if tt.errMsg != "" && err.Error() != tt.errMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if contest == nil {
					t.Errorf("Expected contest, got nil")
				} else if contest.Title != tt.title {
					t.Errorf("Expected title '%s', got '%s'", tt.title, contest.Title)
				}
			}
		})
	}
}

func TestTopPetService_GetContest(t *testing.T) {
	tests := []struct {
		name           string
		contestID      model.ContestID
		getContestFunc func(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		countVotesFunc func(ctx context.Context, contestID model.ContestID) (int64, error)
		wantErr        bool
		expectedVotes  int64
	}{
		{
			name:      "successful get",
			contestID: "test-contest-id",
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1,
					Title:           "Test Contest",
					Status:          model.ContestStatusDraft,
				}, nil
			},
			countVotesFunc: func(ctx context.Context, contestID model.ContestID) (int64, error) {
				return 42, nil
			},
			wantErr:       false,
			expectedVotes: 42,
		},
		{
			name:      "contest not found",
			contestID: "non-existent",
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return nil, errors.New("not found")
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockRepository{
				getContestFunc:         tt.getContestFunc,
				countVotesByContestFunc: tt.countVotesFunc,
			}
			service := &TopPetService{
				repository: mockRepo,
			}

			ctx := context.Background()
			contest, err := service.GetContest(ctx, tt.contestID)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if contest == nil {
					t.Errorf("Expected contest, got nil")
				} else if contest.TotalVotes != tt.expectedVotes {
					t.Errorf("Expected total votes %d, got %d", tt.expectedVotes, contest.TotalVotes)
				}
			}
		})
	}
}

func TestTopPetService_UpdateContest(t *testing.T) {
	tests := []struct {
		name           string
		contestID      model.ContestID
		userID         model.UserID
		title          string
		description    string
		getContestFunc func(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		updateFunc     func(ctx context.Context, contestID model.ContestID, title, description string) (*model.Contest, error)
		wantErr        bool
		errMsg         string
	}{
		{
			name:       "successful update",
			contestID:  "test-id",
			userID:     1,
			title:      "Updated Title",
			description: "Updated Description",
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1,
					Status:          model.ContestStatusDraft,
				}, nil
			},
			updateFunc: func(ctx context.Context, contestID model.ContestID, title, description string) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					Title:           title,
					Description:     description,
					CreatedByUserID: 1,
					Status:          model.ContestStatusDraft,
				}, nil
			},
			wantErr: false,
		},
		{
			name:       "not admin",
			contestID:  "test-id",
			userID:     2,
			title:      "Updated Title",
			description: "Updated Description",
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1, // Different user
					Status:          model.ContestStatusDraft,
				}, nil
			},
			wantErr: true,
			errMsg:  "only contest admin can update contest",
		},
		{
			name:       "not draft status",
			contestID:  "test-id",
			userID:     1,
			title:      "Updated Title",
			description: "Updated Description",
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1,
					Status:          model.ContestStatusVoting, // Not draft
				}, nil
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockRepository{
				getContestFunc:    tt.getContestFunc,
				updateContestFunc: tt.updateFunc,
			}
			service := &TopPetService{
				repository: mockRepo,
			}

			ctx := context.Background()
			contest, err := service.UpdateContest(ctx, tt.contestID, tt.userID, tt.title, tt.description)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error, got nil")
				} else if tt.errMsg != "" && err.Error() != tt.errMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if contest == nil {
					t.Errorf("Expected contest, got nil")
				} else if contest.Title != tt.title {
					t.Errorf("Expected title '%s', got '%s'", tt.title, contest.Title)
				}
			}
		})
	}
}

func TestTopPetService_DeleteContest(t *testing.T) {
	tests := []struct {
		name           string
		contestID      model.ContestID
		userID         model.UserID
		getContestFunc func(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		deleteFunc     func(ctx context.Context, contestID model.ContestID) error
		wantErr        bool
		errMsg         string
	}{
		{
			name:      "successful delete",
			contestID: "test-id",
			userID:    1,
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1,
				}, nil
			},
			deleteFunc: func(ctx context.Context, contestID model.ContestID) error {
				return nil
			},
			wantErr: false,
		},
		{
			name:      "not admin",
			contestID:  "test-id",
			userID:    2,
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1, // Different user
				}, nil
			},
			wantErr: true,
			errMsg:  "only contest admin can delete contest",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockRepository{
				getContestFunc:  tt.getContestFunc,
				deleteContestFunc: tt.deleteFunc,
			}
			service := &TopPetService{
				repository: mockRepo,
			}

			ctx := context.Background()
			err := service.DeleteContest(ctx, tt.contestID, tt.userID)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error, got nil")
				} else if tt.errMsg != "" && err.Error() != tt.errMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}
