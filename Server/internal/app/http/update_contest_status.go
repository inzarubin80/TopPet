package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceUpdateContestStatus interface {
		UpdateContestStatus(ctx context.Context, contestID model.ContestID, userID model.UserID, status model.ContestStatus) (*model.Contest, error)
	}

	UpdateContestStatusHandler struct {
		name    string
		service serviceUpdateContestStatus
	}
)

func NewUpdateContestStatusHandler(name string, service serviceUpdateContestStatus) *UpdateContestStatusHandler {
	return &UpdateContestStatusHandler{name: name, service: service}
}

func (h *UpdateContestStatusHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "contestId is required")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Status == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "status is required")
		return
	}

	contest, err := h.service.UpdateContestStatus(r.Context(), contestID, userID, model.ContestStatus(req.Status))
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(contest)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
