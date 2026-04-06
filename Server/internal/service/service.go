package service

import (
	"context"

	"toppet/server/internal/model"
)

type (
	TopPetService struct {
		repository          Repository
		accessTokenService  TokenService
		refreshTokenService TokenService
		hub                 Hub
		providersUserData   map[string]ProviderUserData
	}

	ProviderUserData interface {
		GetUserData(ctx context.Context, authorizationCode string, codeVerifier string) (*model.UserProfileFromProvider, error)
	}

	Repository interface {
		// User
		CreateUser(ctx context.Context, name string) (*model.User, error)
		CreateUserFromProvider(ctx context.Context, userData *model.UserProfileFromProvider) (*model.User, error)
		GetUser(ctx context.Context, userID model.UserID) (*model.User, error)
		GetUserRole(ctx context.Context, userID model.UserID) (string, error)
		UpdateUserName(ctx context.Context, userID model.UserID, name string) (*model.User, error)
		ListUsersForAdmin(ctx context.Context, limit, offset int32) ([]*model.User, error)
		CountUsers(ctx context.Context) (int64, error)
		CountSystemAdmins(ctx context.Context) (int64, error)
		UpdateUserRole(ctx context.Context, userID model.UserID, role string) (*model.User, error)
		IsUserBlocked(ctx context.Context, userID model.UserID) (bool, error)
		UpdateUserBlocked(ctx context.Context, userID model.UserID, blocked bool) (*model.User, error)
		GetUserAuthProvidersByProviderUid(ctx context.Context, providerUID, provider string) (*model.UserAuthProvider, error)
		AddUserAuthProviders(ctx context.Context, userData *model.UserProfileFromProvider, userID model.UserID) (*model.UserAuthProvider, error)
		GetUserAuthProvidersByUserID(ctx context.Context, userID model.UserID) ([]*model.UserAuthProvider, error)
		SetUserAvatarIfEmpty(ctx context.Context, userID model.UserID, avatarURL *string) error
		SetUserEmailIfEmpty(ctx context.Context, userID model.UserID, email string) error

		// Contest
		CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error)
		UpdateContest(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error)
		UpdateContestStatus(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error)
		ListContestsForStatusAutomation(ctx context.Context) ([]*model.Contest, error)
		DeleteContest(ctx context.Context, contestID model.ContestID) error

		// Nominations & jury criteria (организатор)
		CreateNomination(ctx context.Context, contestID model.ContestID, title, description string, sortOrder int, minPhotoCount int32, maxPhotoCount int32) (*model.Nomination, error)
		GetNominationByContest(ctx context.Context, contestID model.ContestID, nominationID string) (*model.Nomination, error)
		UpdateNomination(ctx context.Context, contestID model.ContestID, nominationID string, title, description string, minPhotoCount int32, maxPhotoCount int32) (*model.Nomination, error)
		UpdateNominationLogoUrl(ctx context.Context, contestID model.ContestID, nominationID string, logoURL string) (*model.Nomination, error)
		ListNominationsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error)
		ListNominationsForContests(ctx context.Context, contestIDs []model.ContestID) ([]*model.Nomination, error)
		DeleteNomination(ctx context.Context, nominationID string) error
		ReorderNominationsByContest(ctx context.Context, contestID model.ContestID, orderedIDs []string) error
		CountNominationsByContest(ctx context.Context, contestID model.ContestID) (int64, error)
		ListJuryCriteriaByContest(ctx context.Context, contestID model.ContestID) ([]*model.JuryCriterion, error)
		ReplaceContestJuryCriteria(ctx context.Context, contestID model.ContestID, items []*model.JuryCriterionInput) error
		ListRegistrationFieldsByContest(ctx context.Context, contestID model.ContestID) ([]*model.RegistrationField, error)
		ReplaceContestRegistrationFields(ctx context.Context, contestID model.ContestID, items []*model.RegistrationFieldInput) error

		// Jury members & user search
		ListContestJuryMembers(ctx context.Context, contestID model.ContestID) ([]*model.JuryMember, error)
		GetContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.JuryMember, error)
		AddContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.JuryMember, error)
		UpdateContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID, portfolioURL, bioShort string, sortOrder int32) (*model.JuryMember, error)
		ReorderContestJuryMembers(ctx context.Context, contestID model.ContestID, orderedUserIDs []model.UserID) error
		RemoveContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) error
		CountContestJuryMembers(ctx context.Context, contestID model.ContestID) (int64, error)
		CountContestJuryCriteria(ctx context.Context, contestID model.ContestID) (int64, error)
		IsContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (bool, error)
		UpsertContestJuryScore(ctx context.Context, participantID model.ParticipantID, criterionID string, userID model.UserID, score int32) (*model.JuryScore, error)
		ListContestJuryScoresByParticipantAndUser(ctx context.Context, participantID model.ParticipantID, userID model.UserID) ([]*model.JuryScore, error)
		ListContestJuryScoresReportByParticipant(ctx context.Context, participantID model.ParticipantID) ([]*model.JuryScoreReportItem, error)
		ListContestJuryVotingProgressByContest(ctx context.Context, contestID model.ContestID) ([]*model.JuryVotingProgressRow, error)
		SumJuryScoresByParticipantID(ctx context.Context, participantID model.ParticipantID) (int64, error)
		SumJuryScoresByParticipantIDs(ctx context.Context, participantIDs []model.ParticipantID) (map[model.ParticipantID]int64, error)
		CountJuryFullyScoredJurorsByParticipantIDs(ctx context.Context, participantIDs []model.ParticipantID) (map[model.ParticipantID]int64, error)
		SearchUsersByQuery(ctx context.Context, q string, limit int32) ([]*model.UserSearchHit, error)

		// Participant
		CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, petName, petDescription string, registrationAnswers map[string]interface{}, nominationID *string) (*model.Participant, error)
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
		GetParticipantByContestUserAndNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID *string) (*model.Participant, error)
		ListParticipantsByContest(ctx context.Context, contestID model.ContestID, viewer *model.UserID, includeAll bool, nominationFilter *model.ParticipantListNominationFilter, juryUnscoredOnly bool, participantScope string, submissionFilter string, votedByViewerOnly bool, limit, offset int32, listOrder string) ([]*model.Participant, int64, error)
		UpdateParticipant(ctx context.Context, participantID model.ParticipantID, petName, petDescription string, registrationAnswers map[string]interface{}) (*model.Participant, error)
		MarkParticipantSubmissionPending(ctx context.Context, participantID model.ParticipantID) error
		SetParticipantSubmissionStatus(ctx context.Context, participantID model.ParticipantID, status string, submissionComment *string) (*model.Participant, error)
		DeleteParticipant(ctx context.Context, participantID model.ParticipantID) error

		// Photos
		AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, url string, thumbURL *string) (*model.Photo, error)
		GetPhotosByParticipantID(ctx context.Context, participantID model.ParticipantID) ([]*model.Photo, error)
		DeleteParticipantPhoto(ctx context.Context, participantID model.ParticipantID, photoID string) error
		UpdateParticipantPhotoOrder(ctx context.Context, participantID model.ParticipantID, photoIDs []string) error

		// Votes
		UpsertContestVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID, nominationID *string) (*model.Vote, error)
		GetContestVoteForUserNominationSlot(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID *string) (*model.Vote, error)
		ListContestVotesByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error)
		DeleteContestVoteByUserAndNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID *string) (model.ParticipantID, error)
		ListAcceptedParticipantScoresForContest(ctx context.Context, contestID model.ContestID) ([]model.ParticipantScoreForWinners, error)
		ListAcceptedParticipantScoresForContests(ctx context.Context, contestIDs []model.ContestID) ([]model.ParticipantScoreForWinners, error)
		CountVotesByContest(ctx context.Context, contestID model.ContestID) (int64, error)
		CountVotesByParticipant(ctx context.Context, participantID model.ParticipantID) (int64, error)
		CountVotesByContests(ctx context.Context, contestIDs []model.ContestID) (map[model.ContestID]int64, error)
		ListVotersByParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID) ([]*model.VoterInfo, error)

		// Comments
		CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string) (*model.Comment, error)
		GetComment(ctx context.Context, commentID model.CommentID) (*model.Comment, error)
		ListCommentsByParticipant(ctx context.Context, participantID model.ParticipantID, limit, offset int) ([]*model.Comment, int64, error)
		UpdateComment(ctx context.Context, commentID model.CommentID, userID model.UserID, text string) (*model.Comment, error)
		DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) error
		ListStaffCommentNotificationsForUser(ctx context.Context, userID model.UserID) ([]*model.StaffCommentNotification, error)
		UpdateParticipantOwnerStaffCommentReadAt(ctx context.Context, participantID model.ParticipantID, ownerUserID model.UserID) error

		// Chat
		CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string, isSystem bool) (*model.ChatMessage, error)
		ListChatMessages(ctx context.Context, contestID model.ContestID, limit, offset int) ([]*model.ChatMessage, int64, error)
		UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error)
		DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) (model.ContestID, error)

	}

	// TokenService интерфейс для работы с JWT токенами
	TokenService interface {
		GenerateToken(userID model.UserID) (string, error)
		ValidateToken(tokenString string) (*model.Claims, error)
	}

	// Hub интерфейс для работы с WebSocket соединениями
	Hub interface {
		BroadcastContestMessage(contestID model.ContestID, payload any) error
		SendContestMessageToUser(contestID model.ContestID, userID model.UserID, payload any) error
	}
)

// NewTopPetService создает новый экземпляр TopPetService с указанными зависимостями
func NewTopPetService(repository Repository, hub Hub, accessTokenService TokenService, refreshTokenService TokenService, providersUserData map[string]ProviderUserData) *TopPetService {
	return &TopPetService{
		repository:          repository,
		hub:                 hub,
		accessTokenService:  accessTokenService,
		refreshTokenService: refreshTokenService,
		providersUserData:   providersUserData,
	}
}
