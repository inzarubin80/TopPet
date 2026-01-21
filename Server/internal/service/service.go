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

		// Photos & Videos
		AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, url string, thumbURL *string) (*model.Photo, error)
		GetPhotosByParticipantID(ctx context.Context, participantID model.ParticipantID) ([]*model.Photo, error)
		UpsertParticipantVideo(ctx context.Context, participantID model.ParticipantID, url string) (*model.Video, error)
		GetVideoByParticipantID(ctx context.Context, participantID model.ParticipantID) (*model.Video, error)

		// Votes
		UpsertContestVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error)
		GetContestVoteByUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Vote, error)
		CountVotesByContest(ctx context.Context, contestID model.ContestID) (int64, error)
		CountVotesByParticipant(ctx context.Context, participantID model.ParticipantID) (int64, error)

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
		DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) error
	}

	TokenService interface {
		GenerateToken(userID model.UserID) (string, error)
		ValidateToken(tokenString string) (*model.Claims, error)
	}

	Hub interface {
		BroadcastContestMessage(contestID model.ContestID, payload any) error
		SendContestMessageToUser(contestID model.ContestID, userID model.UserID, payload any) error
	}
)

func NewTopPetService(repository Repository, hub Hub, accessTokenService TokenService, refreshTokenService TokenService, providersUserData map[string]ProviderUserData) *TopPetService {
	return &TopPetService{
		repository:          repository,
		hub:                 hub,
		accessTokenService:  accessTokenService,
		refreshTokenService: refreshTokenService,
		providersUserData:   providersUserData,
	}
}
