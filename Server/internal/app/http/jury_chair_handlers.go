package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type juryChairService interface {
	GetJuryChairboard(ctx context.Context, contestID model.ContestID, actorID model.UserID, nominationFilter *model.ParticipantListNominationFilter) (*model.JuryChairboardData, error)
	PutJuryChairAssignments(ctx context.Context, contestID model.ContestID, actorID model.UserID, body model.JuryChairAssignmentsPut) (*model.Contest, error)
}

// JuryChairboardHandler — GET /api/contests/{contestId}/jury-chairboard
type JuryChairboardHandler struct {
	name    string
	service juryChairService
}

func NewJuryChairboardHandler(name string, service juryChairService) *JuryChairboardHandler {
	return &JuryChairboardHandler{name: name, service: service}
}

func (h *JuryChairboardHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}
	actorID := r.Context().Value(defenitions.UserID).(model.UserID)

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

	data, err := h.service.GetJuryChairboard(r.Context(), contestID, actorID, nominationFilter)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, data)
}

// JuryChairAssignmentsHandler — PUT /api/contests/{contestId}/jury-chair-assignments
type JuryChairAssignmentsHandler struct {
	name    string
	service juryChairService
}

func NewJuryChairAssignmentsHandler(name string, service juryChairService) *JuryChairAssignmentsHandler {
	return &JuryChairAssignmentsHandler{name: name, service: service}
}

func (h *JuryChairAssignmentsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}
	actorID := r.Context().Value(defenitions.UserID).(model.UserID)

	var body model.JuryChairAssignmentsPut
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid JSON body", err))
		return
	}

	c, err := h.service.PutJuryChairAssignments(r.Context(), contestID, actorID, body)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{
		"contest_id": c.ID,
		"updated_at": c.UpdatedAt,
	})
}
