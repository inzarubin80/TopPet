package model

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt"
)

type (
	UserID        int64
	ContestID     string
	ParticipantID string
	CommentID     string
	ChatMessageID string

	ContestStatus string

	UserProfileFromProvider struct {
		ProviderID   string `json:"provider_id"`
		Email        string `json:"email"`
		Name         string `json:"name"`
		FirstName    string `json:"first_name"`
		LastName     string `json:"last_name"`
		AvatarURL    string `json:"avatar_url"`
		ProviderName string `json:"provider_name"`
	}

	User struct {
		ID        UserID    `json:"id"`
		Name      string    `json:"name"`
		AvatarURL string    `json:"avatar_url,omitempty"`
		CreatedAt time.Time `json:"created_at"`
	}

	UserAuthProvider struct {
		UserID      UserID  `json:"user_id"`
		ProviderUID string  `json:"provider_uid"`
		Provider    string  `json:"provider"`
		Name        *string `json:"name,omitempty"`
	}

	Contest struct {
		ID              ContestID     `json:"id"`
		CreatedByUserID UserID        `json:"created_by_user_id"`
		Title           string        `json:"title"`
		Description     string        `json:"description"`
		Status          ContestStatus `json:"status"`
		TotalVotes      int64         `json:"total_votes,omitempty"`
		CreatedAt       time.Time     `json:"created_at"`
		UpdatedAt       time.Time     `json:"updated_at"`
	}

	Participant struct {
		ID             ParticipantID `json:"id"`
		ContestID      ContestID     `json:"contest_id"`
		UserID         UserID        `json:"user_id"`
		UserName       string        `json:"user_name,omitempty"`
		PetName        string        `json:"pet_name"`
		PetDescription string        `json:"pet_description"`
		Photos         []*Photo      `json:"photos,omitempty"`
		Video          *Video        `json:"video,omitempty"`
		TotalVotes     int64         `json:"total_votes,omitempty"`
		CreatedAt      time.Time     `json:"created_at"`
		UpdatedAt      time.Time     `json:"updated_at"`
	}

	Photo struct {
		ID            string        `json:"id"`
		ParticipantID ParticipantID `json:"participant_id"`
		URL           string        `json:"url"`
		ThumbURL      *string       `json:"thumb_url,omitempty"`
		Position      int           `json:"position"`
		LikeCount     *int64        `json:"like_count,omitempty"`
		IsLiked       *bool         `json:"is_liked,omitempty"`
		CreatedAt     time.Time     `json:"created_at"`
	}

	PhotoLike struct {
		ID        string    `json:"id"`
		PhotoID   string    `json:"photo_id"`
		UserID    UserID    `json:"user_id"`
		CreatedAt time.Time `json:"created_at"`
	}

	Video struct {
		ID            string        `json:"id"`
		ParticipantID ParticipantID `json:"participant_id"`
		URL           string        `json:"url"`
		CreatedAt     time.Time     `json:"created_at"`
		UpdatedAt     time.Time     `json:"updated_at"`
	}

	Vote struct {
		ID            string        `json:"id"`
		ContestID     ContestID     `json:"contest_id"`
		ParticipantID ParticipantID `json:"participant_id"`
		UserID        UserID        `json:"user_id"`
		CreatedAt     time.Time     `json:"created_at"`
		UpdatedAt     time.Time     `json:"updated_at"`
	}

	VoterInfo struct {
		UserID   UserID    `json:"user_id"`
		UserName string    `json:"user_name"`
		VotedAt  time.Time `json:"voted_at"`
	}

	Comment struct {
		ID            CommentID     `json:"id"`
		ParticipantID ParticipantID `json:"participant_id"`
		UserID        UserID        `json:"user_id"`
		UserName      string        `json:"user_name"`
		Text          string        `json:"text"`
		CreatedAt     time.Time     `json:"created_at"`
		UpdatedAt     time.Time     `json:"updated_at"`
	}

	ChatMessage struct {
		ID        ChatMessageID `json:"id"`
		ContestID ContestID     `json:"contest_id"`
		UserID    UserID        `json:"user_id"`
		UserName  string        `json:"user_name"`
		Text      string        `json:"text"`
		IsSystem  bool          `json:"is_system"`
		CreatedAt time.Time     `json:"created_at"`
		UpdatedAt time.Time     `json:"updated_at"`
	}

	AuthData struct {
		UserID       UserID `json:"user_id"`
		RefreshToken string `json:"refresh_token"`
		AccessToken  string `json:"token"`
	}

	Claims struct {
		UserID    UserID `json:"user_id"`
		TokenType string `json:"token_type"`
		jwt.StandardClaims
	}
)

const (
	AccessTokenType  = "access"
	RefreshTokenType = "refresh"

	ContestStatusDraft        ContestStatus = "draft"
	ContestStatusRegistration ContestStatus = "registration"
	ContestStatusVoting       ContestStatus = "voting"
	ContestStatusFinished     ContestStatus = "finished"
)

var (
	ErrorNotFound  = errors.New("not found")
	ErrorForbidden = errors.New("forbidden")
)
