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
		ProviderID string `json:"provider_id"`
		Email      string `json:"email"`
		Name       string `json:"name"`
		FirstName  string `json:"first_name"`
		LastName   string `json:"last_name"`
		Phone      string `json:"phone"`
		// DateOfBirth — только из OAuth-провайдеров, где дата известна целиком (год не 0000).
		DateOfBirth  *time.Time `json:"date_of_birth,omitempty"`
		AvatarURL    string     `json:"avatar_url"`
		ProviderName string     `json:"provider_name"`
	}

	User struct {
		ID    UserID `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email,omitempty"`
		Phone string `json:"phone,omitempty"`
		Role  string `json:"role"`
		// IsBlocked — аккаунт заблокирован администратором системы (мутации API запрещены).
		IsBlocked bool   `json:"is_blocked"`
		AvatarURL string `json:"avatar_url,omitempty"`
		// DateOfBirth — дата в UTC (время 00:00:00).
		DateOfBirth *time.Time `json:"date_of_birth,omitempty"`
		CreatedAt   time.Time  `json:"created_at"`
		// AuthProviders заполняется только в GET /api/admin/users (OAuth-провайдеры аккаунта).
		AuthProviders []string `json:"auth_providers,omitempty"`
	}

	// CurrentUserPatch — частичное обновление профиля (PATCH /api/auth/me). Поле nil = не менять.
	CurrentUserPatch struct {
		Name        *string `json:"name"`
		Email       *string `json:"email"`
		Phone       *string `json:"phone"`
		DateOfBirth *string `json:"date_of_birth"` // YYYY-MM-DD; пустая строка — сбросить дату
		AvatarURL   *string `json:"avatar_url"`
	}

	UserAuthProvider struct {
		UserID      UserID  `json:"user_id"`
		ProviderUID string  `json:"provider_uid"`
		Provider    string  `json:"provider"`
		Name        *string `json:"name,omitempty"`
	}

	Contest struct {
		ID                  ContestID           `json:"id"`
		CreatedByUserID     UserID              `json:"created_by_user_id"`
		Title               string              `json:"title"`
		Description         string              `json:"description"`
		Status              ContestStatus       `json:"status"`
		Tier                string              `json:"tier,omitempty"`
		TotalVotes          int64               `json:"total_votes,omitempty"`
		PublicVotingEnabled bool                `json:"public_voting_enabled"`
		JuryVotingEnabled   bool                `json:"jury_voting_enabled"`
		CoverUrl            string              `json:"cover_url,omitempty"`
		Tagline             string              `json:"tagline,omitempty"`
		RulesText           string              `json:"rules_text,omitempty"`
		PrizeText           string              `json:"prize_text,omitempty"`
		JuryPrizePlaces     []ContestPrizePlace `json:"jury_prize_places,omitempty"`
		AudiencePrizePlaces []ContestPrizePlace `json:"audience_prize_places,omitempty"`
		LogoUrl             string              `json:"logo_url,omitempty"`
		ThemeColor          string              `json:"theme_color,omitempty"`
		SponsorName         string              `json:"sponsor_name,omitempty"`
		SponsorLogoUrl      string              `json:"sponsor_logo_url,omitempty"`
		SponsorUrl          string              `json:"sponsor_url,omitempty"`
		CtaLabelOverride    string              `json:"cta_label_override,omitempty"`
		// Домены e-mail; пустой список — участвовать может любой (см. подачу заявки).
		ParticipantAllowedEmailDomains []string `json:"participant_allowed_email_domains,omitempty"`
		// Расписание фаз (UTC, RFC3339 в JSON). Планировщик сверяет «сейчас» с датами и выставляет статус (в т.ч. откат в черновик).
		PublicationStartsAt  *time.Time `json:"publication_starts_at,omitempty"`
		RegistrationStartsAt *time.Time `json:"registration_starts_at,omitempty"`
		VotingStartsAt       *time.Time `json:"voting_starts_at,omitempty"`
		VotingEndsAt         *time.Time `json:"voting_ends_at,omitempty"`
		// IANA (например Europe/Moscow) — в каком поясе организатор задаёт даты на клиенте.
		ScheduleTimezone string `json:"schedule_timezone,omitempty"`
		// MinPhotoCount — минимум фото в заявке для всего конкурса (1–30).
		MinPhotoCount int `json:"min_photo_count"`
		// MaxPhotoCount — максимум фото в заявке (1–30), не меньше MinPhotoCount.
		MaxPhotoCount int `json:"max_photo_count"`
		// Подсказка организатора для поля «Наименование» в заявке участника.
		EntryTitleHint string    `json:"entry_title_hint,omitempty"`
		CreatedAt      time.Time `json:"created_at"`
		UpdatedAt      time.Time `json:"updated_at"`
		// VotingResultsComputedAt — момент сохранения снимка результатов (nil = только живой пересчёт из голосов).
		VotingResultsComputedAt *time.Time `json:"voting_results_computed_at,omitempty"`
		// Победители после завершения конкурса (заполняются в GET списка/одного конкурса).
		AudienceWinners []ContestWinnerBrief `json:"audience_winners,omitempty"`
		JuryWinners     []ContestWinnerBrief `json:"jury_winners,omitempty"`
		// Persisted* — загрузка из audience_winners_snapshot / jury_winners_snapshot; json:"-" чтобы не дублировать audience_winners.
		PersistedAudienceWinners []ContestWinnerBrief `json:"-"`
		PersistedJuryWinners     []ContestWinnerBrief `json:"-"`
	}

	ContestPrizePlace struct {
		Place int    `json:"place"`
		Prize string `json:"prize"`
	}

	// ContestWinnerBrief — строка для карточки/списка конкурсов (зрители или жюри).
	ContestWinnerBrief struct {
		ParticipantID   ParticipantID `json:"participant_id"`
		PetName         string        `json:"pet_name"`
		EntryTitle      string        `json:"entry_title,omitempty"`
		NominationID    *string       `json:"nomination_id,omitempty"`
		NominationTitle string        `json:"nomination_title,omitempty"`
		Score           int64         `json:"score"`
		Place           int           `json:"place,omitempty"`
		Prize           string        `json:"prize,omitempty"`
	}

	// ContestUpdate — поля для PATCH конкурса в черновике (после слияния с текущим состоянием).
	ContestUpdate struct {
		Title                          string
		Description                    string
		PublicVotingEnabled            bool
		JuryVotingEnabled              bool
		CoverUrl                       string
		Tagline                        string
		RulesText                      string
		PrizeText                      string
		JuryPrizePlaces                []ContestPrizePlace
		AudiencePrizePlaces            []ContestPrizePlace
		LogoUrl                        string
		ThemeColor                     string
		SponsorName                    string
		SponsorLogoUrl                 string
		SponsorUrl                     string
		CtaLabelOverride               string
		ParticipantAllowedEmailDomains string
		PublicationStartsAt            *time.Time
		RegistrationStartsAt           *time.Time
		VotingStartsAt                 *time.Time
		VotingEndsAt                   *time.Time
		ScheduleTimezone               string
		MinPhotoCount                  int
		MaxPhotoCount                  int
		EntryTitleHint                 string
	}

	// Nomination — категория трека конкурса (без шкал; шкалы задаются критериями жюри на уровне конкурса).
	Nomination struct {
		ID          string    `json:"id"`
		ContestID   ContestID `json:"contest_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		SortOrder   int       `json:"sort_order"`
		// MinPhotoCount / MaxPhotoCount — дублируют лимиты конкурса (для совместимости API).
		MinPhotoCount int `json:"min_photo_count"`
		// MaxPhotoCount — см. MinPhotoCount.
		MaxPhotoCount int       `json:"max_photo_count"`
		LogoUrl       string    `json:"logo_url,omitempty"`
		CreatedAt     time.Time `json:"created_at"`
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
		// ID существующего критерия; пусто — создать новую строку (новый UUID).
		ID          string `json:"id,omitempty"`
		Title       string `json:"title"`
		Description string `json:"description"`
		ScaleMin    int32  `json:"scale_min"`
		ScaleMax    int32  `json:"scale_max"`
		ScaleStep   int32  `json:"scale_step"`
	}

	// JuryMember — член жюри конкурса.
	JuryMember struct {
		ID           string    `json:"id"`
		ContestID    ContestID `json:"contest_id"`
		UserID       UserID    `json:"user_id"`
		UserName     string    `json:"user_name,omitempty"`
		SortOrder    int32     `json:"sort_order"`
		IsChair      bool      `json:"is_chair"`
		PortfolioURL string    `json:"portfolio_url,omitempty"`
		BioShort     string    `json:"bio_short,omitempty"`
		CreatedAt    time.Time `json:"created_at"`
	}

	// JuryMemberPatch — частичное обновление карточки члена жюри (организатор).
	JuryMemberPatch struct {
		PortfolioURL *string `json:"portfolio_url"`
		BioShort     *string `json:"bio_short"`
		SortOrder    *int32  `json:"sort_order"`
		IsChair      *bool   `json:"is_chair"`
	}

	// JuryScore — оценка члена жюри по одному критерию для заявки.
	JuryScore struct {
		ID            string        `json:"id"`
		ParticipantID ParticipantID `json:"participant_id"`
		CriterionID   string        `json:"criterion_id"`
		UserID        UserID        `json:"user_id"`
		Score         int32         `json:"score"`
		CreatedAt     time.Time     `json:"created_at"`
		UpdatedAt     time.Time     `json:"updated_at"`
	}

	// JuryScorePutItem — элемент тела PUT для сохранения оценок жюри.
	JuryScorePutItem struct {
		CriterionID string `json:"criterion_id"`
		Score       int32  `json:"score"`
	}

	// JuryScoreReportItem — строка отчёта «кто какой балл по какому критерию» (для организаторов).
	JuryScoreReportItem struct {
		JurorUserID        UserID    `json:"juror_user_id"`
		JurorName          string    `json:"juror_name"`
		CriterionID        string    `json:"criterion_id"`
		CriterionTitle     string    `json:"criterion_title"`
		CriterionSortOrder int32     `json:"criterion_sort_order"`
		ScaleMin           int32     `json:"scale_min"`
		ScaleMax           int32     `json:"scale_max"`
		Score              int32     `json:"score"`
		ScoreUpdatedAt     time.Time `json:"score_updated_at"`
	}

	// JuryVotingProgressRow — сколько критериев выставил член жюри по конкретной работе (сводка по конкурсу).
	JuryVotingProgressRow struct {
		ParticipantID    ParticipantID `json:"participant_id"`
		PetName          string        `json:"pet_name"`
		EntryTitle       string        `json:"entry_title,omitempty"`
		SubmissionStatus string        `json:"submission_status"`
		JurorUserID      UserID        `json:"juror_user_id"`
		JurorName        string        `json:"juror_name"`
		CriteriaScored   int32         `json:"criteria_scored"`
	}

	// UserSearchHit — результат поиска пользователя (имя / email).
	UserSearchHit struct {
		ID    UserID `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email,omitempty"`
	}

	// RegistrationField — дополнительное поле заявки участника (настраивает организатор).
	RegistrationField struct {
		ID          string    `json:"id"`
		ContestID   ContestID `json:"contest_id"`
		SortOrder   int       `json:"sort_order"`
		Label       string    `json:"label"`
		FieldType   string    `json:"field_type"` // string | number | boolean | enum | textarea | image
		Required    bool      `json:"required"`
		EnumOptions []string  `json:"enum_options,omitempty"`
		HelpText    string    `json:"help_text,omitempty"`
		CreatedAt   time.Time `json:"created_at"`
	}

	RegistrationFieldInput struct {
		ID          string   `json:"id,omitempty"`
		Label       string   `json:"label"`
		FieldType   string   `json:"field_type"`
		Required    bool     `json:"required"`
		EnumOptions []string `json:"enum_options,omitempty"`
		HelpText    string   `json:"help_text,omitempty"`
	}

	Participant struct {
		ID                  ParticipantID          `json:"id"`
		ContestID           ContestID              `json:"contest_id"`
		UserID              UserID                 `json:"user_id"`
		UserName            string                 `json:"user_name,omitempty"`
		UserAvatarURL       string                 `json:"user_avatar_url,omitempty"`
		NominationID        *string                `json:"nomination_id,omitempty"`
		SubmissionStatus    string                 `json:"submission_status"`
		SubmissionComment   *string                `json:"submission_comment,omitempty"`
		PetName             string                 `json:"pet_name"`
		PetDescription      string                 `json:"pet_description"`
		EntryTitle          string                 `json:"entry_title,omitempty"`
		EntryDescription    string                 `json:"entry_description,omitempty"`
		RegistrationAnswers map[string]interface{} `json:"registration_answers,omitempty"`
		Photos              []*Photo               `json:"photos,omitempty"`
		CommentCount        int64                  `json:"comment_count,omitempty"`
		TotalVotes          int64                  `json:"total_votes,omitempty"`
		// TotalJuryScore — сумма баллов жюри (организаторам — всегда; остальным — после завершения конкурса).
		TotalJuryScore *int64 `json:"total_jury_score,omitempty"`
		// JuryMemberCount — число членов жюри конкурса (для подписи прогресса оценивания).
		JuryMemberCount *int64 `json:"jury_member_count,omitempty"`
		// JuryCriteriaCount — число критериев оценки.
		JuryCriteriaCount *int64 `json:"jury_criteria_count,omitempty"`
		// JuryFullyScoredJurors — сколько жюри выставили баллы по всем критериям для этой заявки.
		JuryFullyScoredJurors *int64 `json:"jury_fully_scored_jurors,omitempty"`
		// Победители (только для status=finished; внутри номинации — по голосам зрителей / сумме жюри).
		IsAudienceWinner    bool      `json:"is_audience_winner,omitempty"`
		IsJuryWinner        bool      `json:"is_jury_winner,omitempty"`
		AudienceWinnerPlace *int      `json:"audience_winner_place,omitempty"`
		AudienceWinnerPrize string    `json:"audience_winner_prize,omitempty"`
		JuryWinnerPlace     *int      `json:"jury_winner_place,omitempty"`
		JuryWinnerPrize     string    `json:"jury_winner_prize,omitempty"`
		CreatedAt           time.Time `json:"created_at"`
		UpdatedAt           time.Time `json:"updated_at"`
	}

	// ParticipantScoreForWinners — данные для расчёта победителей (принятые заявки).
	ParticipantScoreForWinners struct {
		ContestID     ContestID // для батч-запроса; в одиночном запросе пусто.
		ParticipantID ParticipantID
		PetName       string
		EntryTitle    string
		NominationID  *string
		VoteCount     int64
		JurySum       int64
	}

	// ParticipantListNominationFilter — сужение списка заявок по номинации. Nil = без фильтра (все видимые заявки).
	ParticipantListNominationFilter struct {
		UnassignedOnly bool   // только заявки с nomination_id IS NULL
		NominationID   string // UUID номинации конкурса; не используется при UnassignedOnly
	}

	Photo struct {
		ID            string        `json:"id"`
		ParticipantID ParticipantID `json:"participant_id"`
		URL           string        `json:"url"`
		ThumbURL      *string       `json:"thumb_url,omitempty"`
		Position      int           `json:"position"`
		CreatedAt     time.Time     `json:"created_at"`
	}

	Vote struct {
		ID            string        `json:"id"`
		ContestID     ContestID     `json:"contest_id"`
		ParticipantID ParticipantID `json:"participant_id"`
		NominationID  *string       `json:"nomination_id,omitempty"`
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
		ParentID      *CommentID    `json:"parent_id,omitempty"`
		UserID        UserID        `json:"user_id"`
		UserName      string        `json:"user_name"`
		Text          string        `json:"text"`
		Score         int64         `json:"score"`
		UserVote      int32         `json:"user_vote"`
		CreatedAt     time.Time     `json:"created_at"`
		UpdatedAt     time.Time     `json:"updated_at"`
	}

	// StaffCommentNotification — заявки участника с непрочитанными комментариями организатора конкурса.
	StaffCommentNotification struct {
		ParticipantID        ParticipantID `json:"participant_id"`
		ContestID            ContestID     `json:"contest_id"`
		ContestTitle         string        `json:"contest_title"`
		PetName              string        `json:"pet_name"`
		EntryTitle           string        `json:"entry_title,omitempty"`
		UnreadCount          int64         `json:"unread_count"`
		LatestCommentAt      time.Time     `json:"latest_comment_at"`
		LatestCommentPreview string        `json:"latest_comment_preview,omitempty"`
	}

	ChatMessage struct {
		ID        ChatMessageID  `json:"id"`
		ContestID ContestID      `json:"contest_id"`
		ParentID  *ChatMessageID `json:"parent_id,omitempty"`
		UserID    UserID         `json:"user_id"`
		UserName  string         `json:"user_name"`
		Text      string         `json:"text"`
		IsSystem  bool           `json:"is_system"`
		Score     int64          `json:"score"`
		UserVote  int32          `json:"user_vote"`
		CreatedAt time.Time      `json:"created_at"`
		UpdatedAt time.Time      `json:"updated_at"`
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
	ContestStatusPublication  ContestStatus = "publication"
	ContestStatusRegistration ContestStatus = "registration"
	ContestStatusVoting       ContestStatus = "voting"
	ContestStatusFinished     ContestStatus = "finished"

	UserRoleUser         = "user"
	UserRoleContestAdmin = "contest_admin"
	UserRoleSystemAdmin  = "system_admin"

	ParticipantSubmissionPending  = "pending"
	ParticipantSubmissionAccepted = "accepted"
	ParticipantSubmissionRejected = "rejected"

	ParticipantListScopeAll  = "all"
	ParticipantListScopeMine = "mine"

	// Фильтр списка заявок (только для организаторов конкурса, include_all).
	ParticipantListSubmissionAll         = "all"
	ParticipantListSubmissionAccepted    = "accepted"
	ParticipantListSubmissionPending     = "pending"
	ParticipantListSubmissionRejected    = "rejected"
	ParticipantListSubmissionNonAccepted = "non_accepted"

	// Порядок выдачи списка заявок (GET .../participants?sort=).
	ParticipantListSortVotes     = "votes"
	ParticipantListSortJury      = "jury"
	ParticipantListSortCreatedAt = "created_at"
)

// IsValidUserRole допустимые значения поля users.role.
func IsValidUserRole(r string) bool {
	switch r {
	case UserRoleUser, UserRoleContestAdmin, UserRoleSystemAdmin:
		return true
	default:
		return false
	}
}

// IsGlobalContestManagerRole — роли с правом управлять любым конкурсом наравне с его создателем
// (администратор конкурса платформы и администратор системы).
func IsGlobalContestManagerRole(r string) bool {
	switch r {
	case UserRoleContestAdmin, UserRoleSystemAdmin:
		return true
	default:
		return false
	}
}

var (
	ErrorNotFound  = errors.New("not found")
	ErrorForbidden = errors.New("forbidden")
	// ErrProfileFieldConflict — email или телефон уже заняты другим аккаунтом.
	ErrProfileFieldConflict = errors.New("this email or phone is already in use")
)
