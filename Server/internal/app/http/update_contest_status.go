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
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	if req.Status == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("status is required", nil))
		return
	}

	contest, err := h.service.UpdateContestStatus(r.Context(), contestID, userID, model.ContestStatus(req.Status))
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, contest); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
