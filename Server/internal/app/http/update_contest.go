package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceUpdateContest interface {
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		UpdateContest(ctx context.Context, contestID model.ContestID, userID model.UserID, u model.ContestUpdate) (*model.Contest, error)
	}

	UpdateContestHandler struct {
		name    string
		service serviceUpdateContest
	}
)

var (
	themeColorPattern = regexp.MustCompile(`^(|#[0-9A-Fa-f]{6})$`)
	ctaLabelMaxRunes  = 64
)

func NewUpdateContestHandler(name string, service serviceUpdateContest) *UpdateContestHandler {
	return &UpdateContestHandler{name: name, service: service}
}

func isEmptyOrAllowedURL(s string) bool {
	if s == "" {
		return true
	}
	if strings.HasPrefix(s, "/") && !strings.HasPrefix(s, "//") {
		return true
	}
	u, err := url.Parse(s)
	if err != nil {
		return false
	}
	return u.Scheme == "http" || u.Scheme == "https"
}

func validateContestUpdate(u model.ContestUpdate) string {
	if !themeColorPattern.MatchString(u.ThemeColor) {
		return "theme_color must be empty or #RRGGBB"
	}
	if !isEmptyOrAllowedURL(u.CoverUrl) {
		return "cover_url must be empty, absolute http(s) URL, or path starting with /"
	}
	if !isEmptyOrAllowedURL(u.LogoUrl) {
		return "logo_url must be empty, absolute http(s) URL, or path starting with /"
	}
	if !isEmptyOrAllowedURL(u.RulesUrl) {
		return "rules_url must be empty, absolute http(s) URL, or path starting with /"
	}
	if !isEmptyOrAllowedURL(u.SponsorLogoUrl) {
		return "sponsor_logo_url must be empty, absolute http(s) URL, or path starting with /"
	}
	if !isEmptyOrAllowedURL(u.SponsorUrl) {
		return "sponsor_url must be empty, absolute http(s) URL, or path starting with /"
	}
	if len([]rune(u.CtaLabelOverride)) > ctaLabelMaxRunes {
		return "cta_label_override is too long"
	}
	if len([]rune(u.ScheduleTimezone)) > 120 {
		return "schedule_timezone is too long"
	}
	if err := model.ValidateParticipantEmailDomainsDBString(u.ParticipantAllowedEmailDomains); err != nil {
		return err.Error()
	}
	return ""
}

func contestScheduleTimePtrClone(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	tt := *t
	return &tt
}

func applyContestScheduleString(raw *string, setter func(*time.Time)) error {
	if raw == nil {
		return nil
	}
	if strings.TrimSpace(*raw) == "" {
		setter(nil)
		return nil
	}
	t, err := time.Parse(time.RFC3339, strings.TrimSpace(*raw))
	if err != nil {
		return err
	}
	setter(&t)
	return nil
}

func (h *UpdateContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))

	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}

	var req struct {
		Title                *string `json:"title"`
		Description          *string `json:"description"`
		PublicVotingEnabled  *bool   `json:"public_voting_enabled"`
		JuryVotingEnabled    *bool   `json:"jury_voting_enabled"`
		CoverUrl             *string `json:"cover_url"`
		Tagline              *string `json:"tagline"`
		RulesUrl             *string `json:"rules_url"`
		PrizeText            *string `json:"prize_text"`
		LogoUrl              *string `json:"logo_url"`
		ThemeColor           *string `json:"theme_color"`
		SponsorName          *string `json:"sponsor_name"`
		SponsorLogoUrl       *string `json:"sponsor_logo_url"`
		SponsorUrl           *string `json:"sponsor_url"`
		CtaLabelOverride     *string `json:"cta_label_override"`
		PublicationStartsAt  *string `json:"publication_starts_at"`
		RegistrationStartsAt *string `json:"registration_starts_at"`
		VotingStartsAt       *string `json:"voting_starts_at"`
		VotingEndsAt         *string `json:"voting_ends_at"`
		// IANA, например Europe/Moscow; null — не менять.
		ScheduleTimezone *string `json:"schedule_timezone"`
		// Список доменов e-mail; null — не менять, [] — сбросить ограничение.
		ParticipantAllowedEmailDomains *[]string `json:"participant_allowed_email_domains"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	contest, err := h.service.GetContest(r.Context(), contestID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	u := model.ContestUpdate{
		Title:                          contest.Title,
		Description:                    contest.Description,
		PublicVotingEnabled:            contest.PublicVotingEnabled,
		JuryVotingEnabled:              contest.JuryVotingEnabled,
		CoverUrl:                       contest.CoverUrl,
		Tagline:                        contest.Tagline,
		RulesUrl:                       contest.RulesUrl,
		PrizeText:                      contest.PrizeText,
		LogoUrl:                        contest.LogoUrl,
		ThemeColor:                     contest.ThemeColor,
		SponsorName:                    contest.SponsorName,
		SponsorLogoUrl:                 contest.SponsorLogoUrl,
		SponsorUrl:                     contest.SponsorUrl,
		CtaLabelOverride:               contest.CtaLabelOverride,
		ParticipantAllowedEmailDomains: model.JoinParticipantEmailDomainsDB(contest.ParticipantAllowedEmailDomains),
		PublicationStartsAt:            contestScheduleTimePtrClone(contest.PublicationStartsAt),
		RegistrationStartsAt:           contestScheduleTimePtrClone(contest.RegistrationStartsAt),
		VotingStartsAt:                 contestScheduleTimePtrClone(contest.VotingStartsAt),
		VotingEndsAt:                   contestScheduleTimePtrClone(contest.VotingEndsAt),
		ScheduleTimezone:               contest.ScheduleTimezone,
	}

	if req.Title != nil {
		u.Title = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		u.Description = strings.TrimSpace(*req.Description)
	}
	if req.PublicVotingEnabled != nil {
		u.PublicVotingEnabled = *req.PublicVotingEnabled
	}
	if req.JuryVotingEnabled != nil {
		u.JuryVotingEnabled = *req.JuryVotingEnabled
	}
	if req.CoverUrl != nil {
		u.CoverUrl = strings.TrimSpace(*req.CoverUrl)
	}
	if req.Tagline != nil {
		u.Tagline = strings.TrimSpace(*req.Tagline)
	}
	if req.RulesUrl != nil {
		u.RulesUrl = strings.TrimSpace(*req.RulesUrl)
	}
	if req.PrizeText != nil {
		u.PrizeText = strings.TrimSpace(*req.PrizeText)
	}
	if req.LogoUrl != nil {
		u.LogoUrl = strings.TrimSpace(*req.LogoUrl)
	}
	if req.ThemeColor != nil {
		u.ThemeColor = strings.TrimSpace(*req.ThemeColor)
	}
	if req.SponsorName != nil {
		u.SponsorName = strings.TrimSpace(*req.SponsorName)
	}
	if req.SponsorLogoUrl != nil {
		u.SponsorLogoUrl = strings.TrimSpace(*req.SponsorLogoUrl)
	}
	if req.SponsorUrl != nil {
		u.SponsorUrl = strings.TrimSpace(*req.SponsorUrl)
	}
	if req.CtaLabelOverride != nil {
		u.CtaLabelOverride = strings.TrimSpace(*req.CtaLabelOverride)
	}

	if err := applyContestScheduleString(req.PublicationStartsAt, func(t *time.Time) { u.PublicationStartsAt = t }); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("publication_starts_at must be RFC3339 or empty", err))
		return
	}
	if err := applyContestScheduleString(req.RegistrationStartsAt, func(t *time.Time) { u.RegistrationStartsAt = t }); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("registration_starts_at must be RFC3339 or empty", err))
		return
	}
	if err := applyContestScheduleString(req.VotingStartsAt, func(t *time.Time) { u.VotingStartsAt = t }); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("voting_starts_at must be RFC3339 or empty", err))
		return
	}
	if err := applyContestScheduleString(req.VotingEndsAt, func(t *time.Time) { u.VotingEndsAt = t }); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("voting_ends_at must be RFC3339 or empty", err))
		return
	}

	if req.ScheduleTimezone != nil {
		u.ScheduleTimezone = strings.TrimSpace(*req.ScheduleTimezone)
	}

	if req.ParticipantAllowedEmailDomains != nil {
		norm, derr := model.ValidateAndNormalizeEmailDomains(*req.ParticipantAllowedEmailDomains)
		if derr != nil {
			uhttp.HandleError(w, uhttp.NewBadRequestError(derr.Error(), derr))
			return
		}
		u.ParticipantAllowedEmailDomains = model.JoinParticipantEmailDomainsDB(norm)
	}

	if msg := validateContestUpdate(u); msg != "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError(msg, nil))
		return
	}

	updated, err := h.service.UpdateContest(r.Context(), contestID, userID, u)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, updated); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
