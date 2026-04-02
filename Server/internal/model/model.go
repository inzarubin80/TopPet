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
		Tier            string        `json:"tier,omitempty"`
		TotalVotes      int64         `json:"total_votes,omitempty"`
		CreatedAt       time.Time     `json:"created_at"`
		UpdatedAt       time.Time     `json:"updated_at"`
	}

	// Nomination — категория трека конкурса (без шкал; шкалы задаются критериями жюри на уровне конкурса).
	Nomination struct {
		ID          string    `json:"id"`
		ContestID   ContestID `json:"contest_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		SortOrder   int       `json:"sort_order"`
		CreatedAt   time.Time `json:"created_at"`
	}

	// JuryCriterion — критерий оценки жюри для всего конкурса (одинаков для всех номинаций).
	JuryCriterion struct {
		ID          string    `json:"id"`
		ContestID   ContestID `json:"contest_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		ScaleMin    int32     `json:"scale_min"`
		ScaleMax    int32     `json:"scale_max"`
		ScaleStep   int32     `json:"scale_step"`
		SortOrder   int32     `json:"sort_order"`
		CreatedAt   time.Time `json:"created_at"`
	}

	JuryCriterionInput struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		ScaleMin    int32  `json:"scale_min"`
		ScaleMax    int32  `json:"scale_max"`
		ScaleStep   int32  `json:"scale_step"`
	}

	// RegistrationField — дополнительное поле заявки участника (настраивает организатор).
	RegistrationField struct {
		ID          string    `json:"id"`
		ContestID   ContestID `json:"contest_id"`
		SortOrder   int       `json:"sort_order"`
		Label       string    `json:"label"`
		FieldType   string    `json:"field_type"` // string | number | boolean | enum
		Required    bool      `json:"required"`
		EnumOptions []string  `json:"enum_options,omitempty"`
		CreatedAt   time.Time `json:"created_at"`
	}

	RegistrationFieldInput struct {
		ID          string   `json:"id,omitempty"`
		Label       string   `json:"label"`
		FieldType   string   `json:"field_type"`
		Required    bool     `json:"required"`
		EnumOptions []string `json:"enum_options,omitempty"`
	}

	Participant struct {
		ID                  ParticipantID          `json:"id"`
		ContestID           ContestID              `json:"contest_id"`
		UserID              UserID                 `json:"user_id"`
		UserName            string                 `json:"user_name,omitempty"`
		PetName             string                 `json:"pet_name"`
		PetDescription      string                 `json:"pet_description"`
		RegistrationAnswers map[string]interface{} `json:"registration_answers,omitempty"`
		Photos              []*Photo               `json:"photos,omitempty"`
		Video               *Video                 `json:"video,omitempty"`
		TotalVotes          int64                  `json:"total_votes,omitempty"`
		CreatedAt           time.Time              `json:"created_at"`
		UpdatedAt           time.Time              `json:"updated_at"`
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
