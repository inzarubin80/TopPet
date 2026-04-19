package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"toppet/server/internal/model"
)

func mockRoleContestAdmin(ctx context.Context, userID model.UserID) (string, error) {
	return model.UserRoleContestAdmin, nil
}

// mockRepository мок для Repository
type mockRepository struct {
	createContestFunc               func(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
	getContestFunc                  func(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
	updateContestFunc               func(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error)
	updateContestStatusFunc         func(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error)
	deleteContestFunc               func(ctx context.Context, contestID model.ContestID) error
	listContestsFunc                func(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error)
	countVotesByContestFunc         func(ctx context.Context, contestID model.ContestID) (int64, error)
	countVotesByContestsFunc        func(ctx context.Context, contestIDs []model.ContestID) (map[model.ContestID]int64, error)
	listNominationsByContestFunc    func(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error)
	reorderNominationsByContestFunc func(ctx context.Context, contestID model.ContestID, orderedIDs []string) error
	getUserRoleFunc                 func(ctx context.Context, userID model.UserID) (string, error)
	listUsersForAdminFunc           func(ctx context.Context, limit, offset int32) ([]*model.User, error)
	countUsersFunc                  func(ctx context.Context) (int64, error)
	getChatMessageFunc              func(ctx context.Context, messageID model.ChatMessageID) (*model.ChatMessage, error)
	getCommentFunc                  func(ctx context.Context, commentID model.CommentID) (*model.Comment, error)
	getParticipantFunc              func(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
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

func (m *mockRepository) UpdateContest(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error) {
	if m.updateContestFunc != nil {
		return m.updateContestFunc(ctx, contestID, u)
	}
	return nil, nil
}

func (m *mockRepository) SyncNominationPhotoCountsByContest(ctx context.Context, contestID model.ContestID, minPhotoCount, maxPhotoCount int32) error {
	return nil
}

func (m *mockRepository) UpdateContestStatus(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error) {
	if m.updateContestStatusFunc != nil {
		return m.updateContestStatusFunc(ctx, contestID, status)
	}
	return nil, nil
}

func (m *mockRepository) UpdateContestVotingResults(ctx context.Context, contestID model.ContestID, audience, jury []model.ContestWinnerBrief) (*model.Contest, error) {
	return nil, nil
}

func (m *mockRepository) ListContestsForStatusAutomation(ctx context.Context) ([]*model.Contest, error) {
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
func (m *mockRepository) CreateUser(ctx context.Context, name string) (*model.User, error) {
	return nil, nil
}
func (m *mockRepository) CreateUserFromProvider(ctx context.Context, userData *model.UserProfileFromProvider) (*model.User, error) {
	return nil, nil
}
func (m *mockRepository) GetUser(ctx context.Context, userID model.UserID) (*model.User, error) {
	return nil, nil
}
func (m *mockRepository) UpdateUserName(ctx context.Context, userID model.UserID, name string) (*model.User, error) {
	return nil, nil
}
func (m *mockRepository) UpdateUserProfile(ctx context.Context, userID model.UserID, u *model.User) (*model.User, error) {
	return nil, nil
}
func (m *mockRepository) IsUserBlocked(ctx context.Context, userID model.UserID) (bool, error) {
	return false, nil
}
func (m *mockRepository) UpdateUserBlocked(ctx context.Context, userID model.UserID, blocked bool) (*model.User, error) {
	return nil, nil
}
func (m *mockRepository) GetUserAuthProvidersByProviderUid(ctx context.Context, providerUID, provider string) (*model.UserAuthProvider, error) {
	return nil, nil
}
func (m *mockRepository) AddUserAuthProviders(ctx context.Context, userData *model.UserProfileFromProvider, userID model.UserID) (*model.UserAuthProvider, error) {
	return nil, nil
}
func (m *mockRepository) GetUserAuthProvidersByUserID(ctx context.Context, userID model.UserID) ([]*model.UserAuthProvider, error) {
	return nil, nil
}
func (m *mockRepository) SetUserAvatarIfEmpty(ctx context.Context, userID model.UserID, avatarURL *string) error {
	return nil
}
func (m *mockRepository) SetUserEmailIfEmpty(ctx context.Context, userID model.UserID, email string) error {
	return nil
}
func (m *mockRepository) SetUserPhoneIfEmpty(ctx context.Context, userID model.UserID, phone string) error {
	return nil
}
func (m *mockRepository) SetUserDateOfBirthIfEmpty(ctx context.Context, userID model.UserID, dob *time.Time) error {
	return nil
}

// ListContests, UpdateContest, UpdateContestStatus, DeleteContest реализованы ниже с поддержкой моков
func (m *mockRepository) CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, entryTitle, entryDescription, authorName string, registrationAnswers map[string]interface{}, nominationID *string, policyVersion, consentIP, consentUserAgent string) (*model.Participant, error) {
	return nil, nil
}
func (m *mockRepository) GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error) {
	if m.getParticipantFunc != nil {
		return m.getParticipantFunc(ctx, participantID)
	}
	return nil, nil
}
func (m *mockRepository) GetParticipantByContestUserAndNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID *string) (*model.Participant, error) {
	return nil, model.ErrorNotFound
}
func (m *mockRepository) ListParticipantsByContest(ctx context.Context, contestID model.ContestID, viewer *model.UserID, includeAll bool, nominationFilter *model.ParticipantListNominationFilter, juryUnscoredOnly bool, participantScope string, submissionFilter string, votedByViewerOnly bool, favoriteOnly bool, limit, offset int32, listOrder string) ([]*model.Participant, int64, error) {
	return nil, 0, nil
}
func (m *mockRepository) IsParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) (bool, error) {
	return false, nil
}
func (m *mockRepository) UpsertParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) error {
	return nil
}
func (m *mockRepository) DeleteParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) error {
	return nil
}
func (m *mockRepository) UpdateParticipant(ctx context.Context, participantID model.ParticipantID, entryTitle, entryDescription, authorName string, registrationAnswers map[string]interface{}, nominationID *string) (*model.Participant, error) {
	return nil, nil
}
func (m *mockRepository) MarkParticipantSubmissionPending(ctx context.Context, participantID model.ParticipantID) error {
	return nil
}
func (m *mockRepository) SetParticipantSubmissionStatus(ctx context.Context, participantID model.ParticipantID, status string, submissionComment *string) (*model.Participant, error) {
	return nil, nil
}
func (m *mockRepository) DeleteParticipant(ctx context.Context, participantID model.ParticipantID) error {
	return nil
}
func (m *mockRepository) AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, url string, thumbURL *string) (*model.Photo, error) {
	return nil, nil
}
func (m *mockRepository) GetPhotosByParticipantID(ctx context.Context, participantID model.ParticipantID) ([]*model.Photo, error) {
	return nil, nil
}
func (m *mockRepository) DeleteParticipantPhoto(ctx context.Context, participantID model.ParticipantID, photoID string) error {
	return nil
}
func (m *mockRepository) UpdateParticipantPhotoOrder(ctx context.Context, participantID model.ParticipantID, photoIDs []string) error {
	return nil
}
func (m *mockRepository) UpsertContestVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID, nominationID *string) (*model.Vote, error) {
	return nil, nil
}
func (m *mockRepository) ListContestVotesByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error) {
	return nil, nil
}
func (m *mockRepository) DeleteContestVoteByUserAndParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, participantID model.ParticipantID) (model.ParticipantID, error) {
	return "", nil
}
func (m *mockRepository) ListAcceptedParticipantScoresForContest(ctx context.Context, contestID model.ContestID) ([]model.ParticipantScoreForWinners, error) {
	return nil, nil
}
func (m *mockRepository) ListAcceptedParticipantScoresForContests(ctx context.Context, contestIDs []model.ContestID) ([]model.ParticipantScoreForWinners, error) {
	return nil, nil
}
func (m *mockRepository) ListVotersByParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID) ([]*model.VoterInfo, error) {
	return nil, nil
}

// CountVotesByContest, CountVotesByContests реализованы ниже с поддержкой моков
func (m *mockRepository) CountVotesByParticipant(ctx context.Context, participantID model.ParticipantID) (int64, error) {
	return 0, nil
}
func (m *mockRepository) CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string, parentID *model.CommentID, imageURL string) (*model.Comment, error) {
	return nil, nil
}
func (m *mockRepository) GetComment(ctx context.Context, commentID model.CommentID) (*model.Comment, error) {
	if m.getCommentFunc != nil {
		return m.getCommentFunc(ctx, commentID)
	}
	return nil, nil
}
func (m *mockRepository) ListCommentsByParticipant(ctx context.Context, participantID model.ParticipantID, viewer *model.UserID, limit, offset int) ([]*model.Comment, int64, error) {
	return nil, 0, nil
}
func (m *mockRepository) UpdateComment(ctx context.Context, commentID model.CommentID, userID model.UserID, text string) (*model.Comment, error) {
	return nil, nil
}
func (m *mockRepository) DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) ([]model.CommentID, error) {
	return []model.CommentID{commentID}, nil
}
func (m *mockRepository) UpsertCommentVote(ctx context.Context, commentID model.CommentID, userID model.UserID, value int16) (model.ContestID, model.ParticipantID, int64, error) {
	return "", "", 0, nil
}
func (m *mockRepository) ListStaffCommentNotificationsForUser(ctx context.Context, userID model.UserID) ([]*model.StaffCommentNotification, error) {
	return nil, nil
}
func (m *mockRepository) UpdateParticipantOwnerStaffCommentReadAt(ctx context.Context, participantID model.ParticipantID, ownerUserID model.UserID) error {
	return nil
}
func (m *mockRepository) InsertUserNotification(ctx context.Context, userID model.UserID, kind string, payload json.RawMessage) (*model.UserNotification, error) {
	return nil, nil
}
func (m *mockRepository) CountUnreadUserNotifications(ctx context.Context, userID model.UserID) (int64, error) {
	return 0, nil
}
func (m *mockRepository) ListUserNotificationsForUser(ctx context.Context, userID model.UserID, limit int32, cursorCreatedAt *time.Time, cursorID *model.UserNotificationID) ([]*model.UserNotification, error) {
	return nil, nil
}
func (m *mockRepository) MarkUserNotificationReadByOwner(ctx context.Context, id model.UserNotificationID, ownerUserID model.UserID) (*model.UserNotification, error) {
	return nil, nil
}
func (m *mockRepository) MarkAllUserNotificationsRead(ctx context.Context, userID model.UserID) error {
	return nil
}
func (m *mockRepository) CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string, isSystem bool, parentID *model.ChatMessageID, imageURL string) (*model.ChatMessage, error) {
	return nil, nil
}
func (m *mockRepository) ListChatMessages(ctx context.Context, contestID model.ContestID, viewer *model.UserID, limit, offset int) ([]*model.ChatMessage, int64, error) {
	return nil, 0, nil
}
func (m *mockRepository) GetChatMessage(ctx context.Context, messageID model.ChatMessageID) (*model.ChatMessage, error) {
	if m.getChatMessageFunc != nil {
		return m.getChatMessageFunc(ctx, messageID)
	}
	return nil, model.ErrorNotFound
}
func (m *mockRepository) UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error) {
	return nil, nil
}
func (m *mockRepository) DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) (model.ContestID, []model.ChatMessageID, error) {
	return "", []model.ChatMessageID{messageID}, nil
}
func (m *mockRepository) UpsertChatMessageVote(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, value int16) (model.ContestID, int64, error) {
	return "", 0, nil
}

// CountVotesByContests реализован выше с поддержкой моков

func (m *mockRepository) CreateNomination(ctx context.Context, contestID model.ContestID, title, description string, sortOrder int, minPhotoCount int32, maxPhotoCount int32) (*model.Nomination, error) {
	return nil, nil
}
func (m *mockRepository) GetNominationByContest(ctx context.Context, contestID model.ContestID, nominationID string) (*model.Nomination, error) {
	return nil, nil
}
func (m *mockRepository) UpdateNomination(ctx context.Context, contestID model.ContestID, nominationID string, title, description string, minPhotoCount int32, maxPhotoCount int32) (*model.Nomination, error) {
	return nil, nil
}
func (m *mockRepository) UpdateNominationLogoUrl(ctx context.Context, contestID model.ContestID, nominationID string, logoURL string) (*model.Nomination, error) {
	return &model.Nomination{ID: nominationID, ContestID: contestID, Title: "n", LogoUrl: logoURL}, nil
}
func (m *mockRepository) ListNominationsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error) {
	if m.listNominationsByContestFunc != nil {
		return m.listNominationsByContestFunc(ctx, contestID)
	}
	return nil, nil
}
func (m *mockRepository) ListNominationsForContests(ctx context.Context, contestIDs []model.ContestID) ([]*model.Nomination, error) {
	return nil, nil
}
func (m *mockRepository) DeleteNomination(ctx context.Context, nominationID string) error { return nil }
func (m *mockRepository) ReorderNominationsByContest(ctx context.Context, contestID model.ContestID, orderedIDs []string) error {
	if m.reorderNominationsByContestFunc != nil {
		return m.reorderNominationsByContestFunc(ctx, contestID, orderedIDs)
	}
	return nil
}
func (m *mockRepository) CountNominationsByContest(ctx context.Context, contestID model.ContestID) (int64, error) {
	return 0, nil
}
func (m *mockRepository) ListJuryCriteriaByContest(ctx context.Context, contestID model.ContestID) ([]*model.JuryCriterion, error) {
	return nil, nil
}
func (m *mockRepository) ReplaceContestJuryCriteria(ctx context.Context, contestID model.ContestID, items []*model.JuryCriterionInput) error {
	return nil
}
func (m *mockRepository) ListRegistrationFieldsByContest(ctx context.Context, contestID model.ContestID) ([]*model.RegistrationField, error) {
	return nil, nil
}
func (m *mockRepository) ReplaceContestRegistrationFields(ctx context.Context, contestID model.ContestID, items []*model.RegistrationFieldInput) error {
	return nil
}
func (m *mockRepository) ListContestJuryMembers(ctx context.Context, contestID model.ContestID) ([]*model.JuryMember, error) {
	return nil, nil
}
func (m *mockRepository) GetContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.JuryMember, error) {
	return nil, nil
}
func (m *mockRepository) AddContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.JuryMember, error) {
	return nil, nil
}
func (m *mockRepository) UpdateContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID, portfolioURL, bioShort string, sortOrder int32, isChair bool) (*model.JuryMember, error) {
	return nil, nil
}
func (m *mockRepository) ReorderContestJuryMembers(ctx context.Context, contestID model.ContestID, orderedUserIDs []model.UserID) error {
	return nil
}
func (m *mockRepository) RemoveContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) error {
	return nil
}
func (m *mockRepository) CountContestJuryMembers(ctx context.Context, contestID model.ContestID) (int64, error) {
	return 0, nil
}
func (m *mockRepository) CountContestJuryCriteria(ctx context.Context, contestID model.ContestID) (int64, error) {
	return 0, nil
}
func (m *mockRepository) IsContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (bool, error) {
	return false, nil
}
func (m *mockRepository) UpsertContestJuryScore(ctx context.Context, participantID model.ParticipantID, criterionID string, userID model.UserID, score int32) (*model.JuryScore, error) {
	return nil, nil
}
func (m *mockRepository) ListContestJuryScoresByParticipantAndUser(ctx context.Context, participantID model.ParticipantID, userID model.UserID) ([]*model.JuryScore, error) {
	return nil, nil
}
func (m *mockRepository) ListContestJuryScoresReportByParticipant(ctx context.Context, participantID model.ParticipantID) ([]*model.JuryScoreReportItem, error) {
	return nil, nil
}
func (m *mockRepository) ListContestJuryVotingProgressByContest(ctx context.Context, contestID model.ContestID) ([]*model.JuryVotingProgressRow, error) {
	return nil, nil
}
func (m *mockRepository) SumJuryScoresByParticipantID(ctx context.Context, participantID model.ParticipantID) (float64, error) {
	return 0, nil
}
func (m *mockRepository) SumJuryScoresByParticipantIDs(ctx context.Context, participantIDs []model.ParticipantID) (map[model.ParticipantID]float64, error) {
	return map[model.ParticipantID]float64{}, nil
}
func (m *mockRepository) CountJuryFullyScoredJurorsByParticipantIDs(ctx context.Context, participantIDs []model.ParticipantID) (map[model.ParticipantID]int64, error) {
	return map[model.ParticipantID]int64{}, nil
}

func (m *mockRepository) ListJuryWeightedTotalsByContest(ctx context.Context, contestID model.ContestID) ([]model.JuryChairWeightedCell, error) {
	return nil, nil
}

func (m *mockRepository) SearchUsersByQuery(ctx context.Context, q string, limit int32) ([]*model.UserSearchHit, error) {
	return nil, nil
}

func (m *mockRepository) GetUserRole(ctx context.Context, userID model.UserID) (string, error) {
	if m.getUserRoleFunc != nil {
		return m.getUserRoleFunc(ctx, userID)
	}
	return model.UserRoleUser, nil
}

func (m *mockRepository) ListUsersForAdmin(ctx context.Context, limit, offset int32) ([]*model.User, error) {
	if m.listUsersForAdminFunc != nil {
		return m.listUsersForAdminFunc(ctx, limit, offset)
	}
	return nil, nil
}

func (m *mockRepository) CountUsers(ctx context.Context) (int64, error) {
	if m.countUsersFunc != nil {
		return m.countUsersFunc(ctx)
	}
	return 0, nil
}

func (m *mockRepository) CountSystemAdmins(ctx context.Context) (int64, error) {
	return 0, nil
}

func (m *mockRepository) UpdateUserRole(ctx context.Context, userID model.UserID, role string) (*model.User, error) {
	return nil, nil
}

func (m *mockRepository) DeleteUserAccount(ctx context.Context, userID model.UserID) error {
	return nil
}

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
			errMsg:      "bad request: title is required",
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
		{
			name:        "forbidden for regular user",
			userID:      1,
			title:       "Test Contest",
			description: "Test Description",
			mockFunc:    nil,
			wantErr:     true,
			errMsg:      model.ErrorForbidden.Error(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockRepository{
				createContestFunc: tt.mockFunc,
			}
			if tt.name != "forbidden for regular user" {
				mockRepo.getUserRoleFunc = mockRoleContestAdmin
			} else {
				mockRepo.getUserRoleFunc = func(ctx context.Context, userID model.UserID) (string, error) {
					return model.UserRoleUser, nil
				}
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
				getContestFunc:          tt.getContestFunc,
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
		name            string
		contestID       model.ContestID
		userID          model.UserID
		update          model.ContestUpdate
		getContestFunc  func(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		updateFunc      func(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error)
		getUserRoleFunc func(ctx context.Context, userID model.UserID) (string, error)
		wantErr         bool
		errMsg          string
	}{
		{
			name:      "successful update",
			contestID: "test-id",
			userID:    1,
			update: model.ContestUpdate{
				Title:               "Updated Title",
				Description:         "Updated Description",
				PublicVotingEnabled: true,
				JuryVotingEnabled:   false,
				MinPhotoCount:       1,
				MaxPhotoCount:       30,
			},
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1,
					Status:          model.ContestStatusDraft,
				}, nil
			},
			updateFunc: func(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					Title:           u.Title,
					Description:     u.Description,
					CreatedByUserID: 1,
					Status:          model.ContestStatusDraft,
					MinPhotoCount:   u.MinPhotoCount,
					MaxPhotoCount:   u.MaxPhotoCount,
				}, nil
			},
			wantErr: false,
		},
		{
			name:      "contest_admin_author_can_update",
			contestID: "owned-by-admin",
			userID:    5,
			update: model.ContestUpdate{
				Title:         "T",
				Description:   "D",
				MinPhotoCount: 1,
				MaxPhotoCount: 30,
			},
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 5,
					Status:          model.ContestStatusDraft,
				}, nil
			},
			updateFunc: func(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					Title:           u.Title,
					Description:     u.Description,
					CreatedByUserID: 5,
					Status:          model.ContestStatusDraft,
					MinPhotoCount:   u.MinPhotoCount,
					MaxPhotoCount:   u.MaxPhotoCount,
				}, nil
			},
			getUserRoleFunc: func(ctx context.Context, userID model.UserID) (string, error) {
				return model.UserRoleContestAdmin, nil
			},
			wantErr: false,
		},
		{
			name:      "contest_admin_not_author_can_update",
			contestID: "other-authors-contest",
			userID:    7,
			update: model.ContestUpdate{
				Title:         "T2",
				Description:   "D2",
				MinPhotoCount: 1,
				MaxPhotoCount: 30,
			},
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1,
					Status:          model.ContestStatusDraft,
				}, nil
			},
			updateFunc: func(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					Title:           u.Title,
					Description:     u.Description,
					CreatedByUserID: 1,
					Status:          model.ContestStatusDraft,
					MinPhotoCount:   u.MinPhotoCount,
					MaxPhotoCount:   u.MaxPhotoCount,
				}, nil
			},
			getUserRoleFunc: func(ctx context.Context, userID model.UserID) (string, error) {
				if userID == 7 {
					return model.UserRoleContestAdmin, nil
				}
				return model.UserRoleUser, nil
			},
			wantErr: false,
		},
		{
			name:      "not admin",
			contestID: "test-id",
			userID:    2,
			update: model.ContestUpdate{
				Title:         "Updated Title",
				Description:   "Updated Description",
				MinPhotoCount: 1,
				MaxPhotoCount: 30,
			},
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1, // Different user
					Status:          model.ContestStatusDraft,
				}, nil
			},
			wantErr: true,
			errMsg:  "forbidden: only contest admin can update contest",
		},
		{
			name:      "update_when_voting",
			contestID: "test-id",
			userID:    1,
			update: model.ContestUpdate{
				Title:         "Updated Title",
				Description:   "Updated Description",
				MinPhotoCount: 1,
				MaxPhotoCount: 30,
			},
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1,
					Status:          model.ContestStatusVoting,
				}, nil
			},
			updateFunc: func(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					Title:           u.Title,
					Description:     u.Description,
					CreatedByUserID: 1,
					Status:          model.ContestStatusVoting,
					MinPhotoCount:   u.MinPhotoCount,
					MaxPhotoCount:   u.MaxPhotoCount,
				}, nil
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockRepository{
				getContestFunc:    tt.getContestFunc,
				updateContestFunc: tt.updateFunc,
				getUserRoleFunc:   tt.getUserRoleFunc,
			}
			service := &TopPetService{
				repository: mockRepo,
			}

			ctx := context.Background()
			contest, err := service.UpdateContest(ctx, tt.contestID, tt.userID, tt.update)

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
				} else if contest.Title != tt.update.Title {
					t.Errorf("Expected title '%s', got '%s'", tt.update.Title, contest.Title)
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
			contestID: "test-id",
			userID:    2,
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{
					ID:              contestID,
					CreatedByUserID: 1, // Different user
				}, nil
			},
			wantErr: true,
			errMsg:  "forbidden: only contest admin can delete contest",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockRepository{
				getContestFunc:    tt.getContestFunc,
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

func TestTopPetService_ReorderNominations(t *testing.T) {
	cid := model.ContestID("c1")
	uid := model.UserID(1)
	noms := []*model.Nomination{
		{ID: "a", ContestID: cid, Title: "A"},
		{ID: "b", ContestID: cid, Title: "B"},
	}
	afterReorder := []*model.Nomination{
		{ID: "b", ContestID: cid, Title: "B", SortOrder: 0},
		{ID: "a", ContestID: cid, Title: "A", SortOrder: 1},
	}

	t.Run("wrong count", func(t *testing.T) {
		mockRepo := &mockRepository{
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{ID: contestID, CreatedByUserID: uid}, nil
			},
			listNominationsByContestFunc: func(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error) {
				return noms, nil
			},
		}
		svc := &TopPetService{repository: mockRepo}
		_, err := svc.ReorderNominations(context.Background(), cid, uid, []string{"a"})
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})

	t.Run("unknown id", func(t *testing.T) {
		mockRepo := &mockRepository{
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{ID: contestID, CreatedByUserID: uid}, nil
			},
			listNominationsByContestFunc: func(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error) {
				return noms, nil
			},
		}
		svc := &TopPetService{repository: mockRepo}
		_, err := svc.ReorderNominations(context.Background(), cid, uid, []string{"a", "x"})
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})

	t.Run("duplicate id", func(t *testing.T) {
		mockRepo := &mockRepository{
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{ID: contestID, CreatedByUserID: uid}, nil
			},
			listNominationsByContestFunc: func(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error) {
				return noms, nil
			},
		}
		svc := &TopPetService{repository: mockRepo}
		_, err := svc.ReorderNominations(context.Background(), cid, uid, []string{"a", "a"})
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})

	t.Run("success", func(t *testing.T) {
		var reorderArg []string
		listCalls := 0
		mockRepo := &mockRepository{
			getContestFunc: func(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
				return &model.Contest{ID: contestID, CreatedByUserID: uid}, nil
			},
			listNominationsByContestFunc: func(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error) {
				listCalls++
				if listCalls == 1 {
					return noms, nil
				}
				return afterReorder, nil
			},
			reorderNominationsByContestFunc: func(ctx context.Context, contestID model.ContestID, orderedIDs []string) error {
				reorderArg = orderedIDs
				return nil
			},
		}
		svc := &TopPetService{repository: mockRepo}
		got, err := svc.ReorderNominations(context.Background(), cid, uid, []string{"b", "a"})
		if err != nil {
			t.Fatal(err)
		}
		if len(reorderArg) != 2 || reorderArg[0] != "b" || reorderArg[1] != "a" {
			t.Fatalf("reorder args: %v", reorderArg)
		}
		if len(got) != 2 || got[0].ID != "b" {
			t.Fatalf("got %v", got)
		}
	})
}
