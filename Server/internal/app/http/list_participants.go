package http

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

const (
	participantsListDefaultLimit  int32 = 10000
	participantsListMaxPageLimit  int32 = 100
	participantsListMaxOffset     int64 = 1_000_000
)

func parseTruthyQuery(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

type (
	serviceListParticipants interface {
		ListParticipantsByContest(ctx context.Context, contestID model.ContestID, viewer *model.UserID, nominationFilter *model.ParticipantListNominationFilter, juryUnscoredOnly bool, participantScope string, limit, offset int32) ([]*model.Participant, int64, error)
	}

	ListParticipantsHandler struct {
		name        string
		service     serviceListParticipants
		authService serviceOptionalAuth
	}
)

func NewListParticipantsHandler(name string, service serviceListParticipants) *ListParticipantsHandler {
	var authService serviceOptionalAuth
	if svc, ok := service.(serviceOptionalAuth); ok {
		authService = svc
	}
	return &ListParticipantsHandler{name: name, service: service, authService: authService}
}

func (h *ListParticipantsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}

	var viewer *model.UserID
	if h.authService != nil {
		uid, ok, authErr := getOptionalUserID(r, h.authService)
		if authErr != nil {
			uhttp.HandleError(w, uhttp.NewUnauthorizedError("authentication error", authErr))
			return
		}
		if ok {
			viewer = &uid
		}
	}

	rawNom := strings.TrimSpace(r.URL.Query().Get("nomination_id"))
	var nominationFilter *model.ParticipantListNominationFilter
	switch {
	case rawNom == "":
		nominationFilter = nil
	case strings.EqualFold(rawNom, "none") || strings.EqualFold(rawNom, "null") || strings.EqualFold(rawNom, "unassigned"):
		nominationFilter = &model.ParticipantListNominationFilter{UnassignedOnly: true}
	default:
		if _, err := uuid.Parse(rawNom); err != nil {
			uhttp.HandleError(w, uhttp.NewBadRequestError("nomination_id must be a UUID or none", err))
			return
		}
		nominationFilter = &model.ParticipantListNominationFilter{NominationID: rawNom}
	}

	juryUnscoredOnly := parseTruthyQuery(r.URL.Query().Get("jury_unscored_only"))

	participantScope := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("participant_scope")))
	switch participantScope {
	case "":
		participantScope = model.ParticipantListScopeAll
	case model.ParticipantListScopeAll, model.ParticipantListScopeMine:
		// ok
	default:
		uhttp.HandleError(w, uhttp.NewBadRequestError("participant_scope must be all or mine", nil))
		return
	}
	if participantScope == model.ParticipantListScopeMine && viewer == nil {
		uhttp.HandleError(w, uhttp.NewUnauthorizedError("participant_scope=mine requires authentication", nil))
		return
	}

	limitStr := strings.TrimSpace(r.URL.Query().Get("limit"))
	var limit int32
	if limitStr == "" {
		limit = participantsListDefaultLimit
	} else {
		n, err := strconv.ParseInt(limitStr, 10, 32)
		if err != nil || n < 1 {
			uhttp.HandleError(w, uhttp.NewBadRequestError("limit must be a positive integer", err))
			return
		}
		if n > int64(participantsListMaxPageLimit) {
			n = int64(participantsListMaxPageLimit)
		}
		limit = int32(n)
	}

	offsetStr := strings.TrimSpace(r.URL.Query().Get("offset"))
	var offset int32
	if offsetStr == "" {
		offset = 0
	} else {
		n, err := strconv.ParseInt(offsetStr, 10, 32)
		if err != nil || n < 0 {
			uhttp.HandleError(w, uhttp.NewBadRequestError("offset must be a non-negative integer", err))
			return
		}
		if n > participantsListMaxOffset {
			uhttp.HandleError(w, uhttp.NewBadRequestError("offset is too large", nil))
			return
		}
		offset = int32(n)
	}

	participants, total, err := h.service.ListParticipantsByContest(r.Context(), contestID, viewer, nominationFilter, juryUnscoredOnly, participantScope, limit, offset)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type resp struct {
		Items  []*model.Participant `json:"items"`
		Total  int64                `json:"total"`
		Limit  int32                `json:"limit"`
		Offset int32                `json:"offset"`
	}

	respData := resp{
		Items:  participants,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}

	if err := uhttp.SendSuccess(w, respData); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
