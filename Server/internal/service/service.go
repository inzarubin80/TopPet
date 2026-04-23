package service

import (
	"context"
	"encoding/json"
	"time"

	"toppet/server/internal/model"
)

// LegalDocumentVersions актуальные версии юридических документов с сервера (embed).
type LegalDocumentVersions interface {
	Version(documentID string) (string, error)
}

type (
	TopPetService struct {
		repository          Repository
		accessTokenService  TokenService
		refreshTokenService TokenService
		hub                 Hub
		userNotificationHub UserNotificationHub
		providersUserData   map[string]ProviderUserData
		legalDocs           LegalDocumentVersions
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
		UpdateUserProfile(ctx context.Context, userID model.UserID, u *model.User) (*model.User, error)
		ListUsersForAdmin(ctx context.Context, limit, offset int32) ([]*model.User, error)
		CountUsers(ctx context.Context) (int64, error)
		CountSystemAdmins(ctx context.Context) (int64, error)
		UpdateUserRole(ctx context.Context, userID model.UserID, role string) (*model.User, error)
		IsUserBlocked(ctx context.Context, userID model.UserID) (bool, error)
		UpdateUserBlocked(ctx context.Context, userID model.UserID, blocked bool) (*model.User, error)
		DeleteUserAccount(ctx context.Context, userID model.UserID) error
		GetUserAuthProvidersByProviderUid(ctx context.Context, providerUID, provider string) (*model.UserAuthProvider, error)
		AddUserAuthProviders(ctx context.Context, userData *model.UserProfileFromProvider, userID model.UserID) (*model.UserAuthProvider, error)
		GetUserAuthProvidersByUserID(ctx context.Context, userID model.UserID) ([]*model.UserAuthProvider, error)
		SetUserAvatarIfEmpty(ctx context.Context, userID model.UserID, avatarURL *string) error
		SetUserEmailIfEmpty(ctx context.Context, userID model.UserID, email string) error
		SetUserPhoneIfEmpty(ctx context.Context, userID model.UserID, phone string) error
		SetUserDateOfBirthIfEmpty(ctx context.Context, userID model.UserID, dob *time.Time) error

		// Contest
		CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error)
		UpdateContest(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error)
		SyncNominationPhotoCountsByContest(ctx context.Context, contestID model.ContestID, minPhotoCount, maxPhotoCount int32) error
		UpdateContestStatus(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error)
		UpdateContestVotingResults(ctx context.Context, contestID model.ContestID, audience, jury []model.ContestWinnerBrief) (*model.Contest, error)
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
		UpdateContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID, portfolioURL, bioShort string, sortOrder int32, isChair bool) (*model.JuryMember, error)
		ReorderContestJuryMembers(ctx context.Context, contestID model.ContestID, orderedUserIDs []model.UserID) error
		RemoveContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) error
		CountContestJuryMembers(ctx context.Context, contestID model.ContestID) (int64, error)
		CountContestJuryCriteria(ctx context.Context, contestID model.ContestID) (int64, error)
		IsContestJuryMember(ctx context.Context, contestID model.ContestID, userID model.UserID) (bool, error)
		UpsertContestJuryScore(ctx context.Context, participantID model.ParticipantID, criterionID string, userID model.UserID, score int32) (*model.JuryScore, error)
		ListContestJuryScoresByParticipantAndUser(ctx context.Context, participantID model.ParticipantID, userID model.UserID) ([]*model.JuryScore, error)
		ListContestJuryScoresReportByParticipant(ctx context.Context, participantID model.ParticipantID) ([]*model.JuryScoreReportItem, error)
		ListContestJuryVotingProgressByContest(ctx context.Context, contestID model.ContestID) ([]*model.JuryVotingProgressRow, error)
		SumJuryScoresByParticipantID(ctx context.Context, participantID model.ParticipantID) (float64, error)
		SumJuryScoresByParticipantIDs(ctx context.Context, participantIDs []model.ParticipantID) (map[model.ParticipantID]float64, error)
		CountJuryFullyScoredJurorsByParticipantIDs(ctx context.Context, participantIDs []model.ParticipantID) (map[model.ParticipantID]int64, error)
		ListJuryWeightedTotalsByContest(ctx context.Context, contestID model.ContestID) ([]model.JuryChairWeightedCell, error)
		SearchUsersByQuery(ctx context.Context, q string, limit int32) ([]*model.UserSearchHit, error)

		// Participant
		CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, entryTitle, entryDescription, authorName string, registrationAnswers map[string]interface{}, nominationID *string, privacyPolicyVersion, publicationPolicyVersion, consentIP, consentUserAgent string, recordContestRulesConsentAudit bool) (*model.Participant, error)
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
		GetParticipantByContestUserAndNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID *string) (*model.Participant, error)
		ListParticipantsByContest(ctx context.Context, contestID model.ContestID, viewer *model.UserID, includeAll bool, nominationFilter *model.ParticipantListNominationFilter, juryUnscoredOnly bool, participantScope string, submissionFilter string, votedByViewerOnly bool, favoriteOnly bool, limit, offset int32, listOrder string) ([]*model.Participant, int64, error)
		IsParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) (bool, error)
		UpsertParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) error
		DeleteParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) error
		UpdateParticipant(ctx context.Context, participantID model.ParticipantID, entryTitle, entryDescription, authorName string, registrationAnswers map[string]interface{}, nominationID *string) (*model.Participant, error)
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
		UpsertContestUserVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID, nominationID *string) (*model.Vote, error)
		ListContestVotesByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error)
		ListContestUserVotesByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error)
		DeleteContestVoteByUserAndParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, participantID model.ParticipantID) (model.ParticipantID, error)
		DeleteContestUserVoteByUserAndParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, participantID model.ParticipantID) (model.ParticipantID, error)
		ListAcceptedParticipantScoresForContest(ctx context.Context, contestID model.ContestID) ([]model.ParticipantScoreForWinners, error)
		ListAcceptedParticipantUserVoteScoresForContest(ctx context.Context, contestID model.ContestID) ([]model.ParticipantScoreForWinners, error)
		ListAcceptedParticipantScoresForContests(ctx context.Context, contestIDs []model.ContestID) ([]model.ParticipantScoreForWinners, error)
		ListAcceptedParticipantUserVoteScoresForContests(ctx context.Context, contestIDs []model.ContestID) ([]model.ParticipantScoreForWinners, error)
		CountVotesByContest(ctx context.Context, contestID model.ContestID) (int64, error)
		CountVotesByParticipant(ctx context.Context, participantID model.ParticipantID) (int64, error)
		CountContestUserVotesByContest(ctx context.Context, contestID model.ContestID) (int64, error)
		CountContestUserVotesByParticipant(ctx context.Context, participantID model.ParticipantID) (int64, error)
		CountVotesByContests(ctx context.Context, contestIDs []model.ContestID) (map[model.ContestID]int64, error)
		ListVotersByParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID) ([]*model.VoterInfo, error)
		ListContestUserVotersByParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID) ([]*model.VoterInfo, error)

		// Comments
		CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string, parentID *model.CommentID, imageURL string) (*model.Comment, error)
		GetComment(ctx context.Context, commentID model.CommentID) (*model.Comment, error)
		ListCommentsByParticipant(ctx context.Context, participantID model.ParticipantID, viewer *model.UserID, limit, offset int) ([]*model.Comment, int64, error)
		UpdateComment(ctx context.Context, commentID model.CommentID, userID model.UserID, text string) (*model.Comment, error)
		DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) ([]model.CommentID, error)
		UpsertCommentVote(ctx context.Context, commentID model.CommentID, userID model.UserID, value int16) (model.ContestID, model.ParticipantID, int64, error)
		ListStaffCommentNotificationsForUser(ctx context.Context, userID model.UserID) ([]*model.StaffCommentNotification, error)
		UpdateParticipantOwnerStaffCommentReadAt(ctx context.Context, participantID model.ParticipantID, ownerUserID model.UserID) error

		// Chat
		CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string, isSystem bool, parentID *model.ChatMessageID, imageURL string) (*model.ChatMessage, error)
		ListChatMessages(ctx context.Context, contestID model.ContestID, viewer *model.UserID, limit, offset int) ([]*model.ChatMessage, int64, error)
		GetChatMessage(ctx context.Context, messageID model.ChatMessageID) (*model.ChatMessage, error)
		UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error)
		DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) (model.ContestID, []model.ChatMessageID, error)
		UpsertChatMessageVote(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, value int16) (model.ContestID, int64, error)

		// Direct messages
		GetDirectConversationByID(ctx context.Context, conversationID model.DirectConversationID) (*model.DirectConversation, error)
		GetDirectConversationForUser(ctx context.Context, conversationID model.DirectConversationID, userID model.UserID) (*model.DirectConversation, error)
		GetDirectConversationByPair(ctx context.Context, userAID, userBID model.UserID) (*model.DirectConversation, error)
		GetOrCreateDirectConversationByPair(ctx context.Context, userAID, userBID model.UserID) (*model.DirectConversation, error)
		ListDirectConversationsByUser(ctx context.Context, userID model.UserID, limit, offset int) ([]*model.DirectConversation, int64, error)
		MarkDirectConversationReadForUser(ctx context.Context, conversationID model.DirectConversationID, userID model.UserID) error
		ListDirectConversationPeerUserIDsByUser(ctx context.Context, userID model.UserID) ([]model.UserID, error)
		CreateDirectMessage(ctx context.Context, conversationID model.DirectConversationID, senderUserID model.UserID, text string) (*model.DirectMessage, error)
		ListDirectMessagesByConversation(ctx context.Context, conversationID model.DirectConversationID, limit, offset int) ([]*model.DirectMessage, int64, error)
		GetDirectMessageByID(ctx context.Context, messageID model.DirectMessageID) (*model.DirectMessage, error)
		UpdateDirectMessageByID(ctx context.Context, messageID model.DirectMessageID, text string) (*model.DirectMessage, error)
		DeleteDirectMessageByID(ctx context.Context, messageID model.DirectMessageID) (*model.DirectMessage, error)
		DeleteDirectConversationWithMessages(ctx context.Context, conversationID model.DirectConversationID) error

		// User notifications
		InsertUserNotification(ctx context.Context, userID model.UserID, kind string, payload json.RawMessage) (*model.UserNotification, error)
		CountUnreadUserNotifications(ctx context.Context, userID model.UserID) (int64, error)
		ListUserNotificationsForUser(ctx context.Context, userID model.UserID, limit int32, cursorCreatedAt *time.Time, cursorID *model.UserNotificationID) ([]*model.UserNotification, error)
		MarkUserNotificationReadByOwner(ctx context.Context, id model.UserNotificationID, ownerUserID model.UserID) (*model.UserNotification, error)
		MarkAllUserNotificationsRead(ctx context.Context, userID model.UserID) error
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

	// UserNotificationHub — персональные уведомления (все конкурсы пользователя, без подписки на комнату конкурса).
	UserNotificationHub interface {
		SendToUser(userID model.UserID, payload any) error
		IsUserOnline(userID model.UserID) bool
	}
)

// NewTopPetService создает новый экземпляр TopPetService с указанными зависимостями.
// legalDocs может быть nil (тесты): проверка совпадения версий документов не выполняется.
func NewTopPetService(repository Repository, hub Hub, userNotificationHub UserNotificationHub, accessTokenService TokenService, refreshTokenService TokenService, providersUserData map[string]ProviderUserData, legalDocs LegalDocumentVersions) *TopPetService {
	return &TopPetService{
		repository:          repository,
		hub:                 hub,
		userNotificationHub: userNotificationHub,
		accessTokenService:  accessTokenService,
		refreshTokenService: refreshTokenService,
		providersUserData:   providersUserData,
		legalDocs:           legalDocs,
	}
}
