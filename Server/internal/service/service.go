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
		UpdateUserName(ctx context.Context, userID model.UserID, name string) (*model.User, error)
		GetUserAuthProvidersByProviderUid(ctx context.Context, providerUID, provider string) (*model.UserAuthProvider, error)
		AddUserAuthProviders(ctx context.Context, userData *model.UserProfileFromProvider, userID model.UserID) (*model.UserAuthProvider, error)
		GetUserAuthProvidersByUserID(ctx context.Context, userID model.UserID) ([]*model.UserAuthProvider, error)
		SetUserAvatarIfEmpty(ctx context.Context, userID model.UserID, avatarURL *string) error

		// Contest
		CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error)
		UpdateContest(ctx context.Context, contestID model.ContestID, title, description string) (*model.Contest, error)
		UpdateContestStatus(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error)
		DeleteContest(ctx context.Context, contestID model.ContestID) error

		// Participant
		CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, petName, petDescription string) (*model.Participant, error)
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
		GetParticipantByContestAndUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Participant, error)
		ListParticipantsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Participant, error)
		UpdateParticipant(ctx context.Context, participantID model.ParticipantID, petName, petDescription string) (*model.Participant, error)
		DeleteParticipant(ctx context.Context, participantID model.ParticipantID) error

		// Photos & Videos
		AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, url string, thumbURL *string) (*model.Photo, error)
		GetPhotosByParticipantID(ctx context.Context, participantID model.ParticipantID) ([]*model.Photo, error)
		DeleteParticipantPhoto(ctx context.Context, participantID model.ParticipantID, photoID string) error
		UpdateParticipantPhotoOrder(ctx context.Context, participantID model.ParticipantID, photoIDs []string) error
		UpsertParticipantVideo(ctx context.Context, participantID model.ParticipantID, url string) (*model.Video, error)
		GetVideoByParticipantID(ctx context.Context, participantID model.ParticipantID) (*model.Video, error)
		DeleteParticipantVideo(ctx context.Context, participantID model.ParticipantID) error

		// Votes
		UpsertContestVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error)
		GetContestVoteByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Vote, error)
		DeleteContestVoteByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (model.ParticipantID, error)
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

		// Chat
		CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string, isSystem bool) (*model.ChatMessage, error)
		ListChatMessages(ctx context.Context, contestID model.ContestID, limit, offset int) ([]*model.ChatMessage, int64, error)
		UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error)
		DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) (model.ContestID, error)

		// Photo Likes
		UpsertPhotoLike(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error)
		DeletePhotoLike(ctx context.Context, photoID string, userID model.UserID) error
		GetPhotoLikeByUser(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error)
		CountPhotoLikes(ctx context.Context, photoID string) (int64, error)
		ListPhotoLikesByPhotos(ctx context.Context, photoIDs []string, userID model.UserID) (map[string]*model.PhotoLike, error)
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
