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
	serviceUpdateContest interface {
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		UpdateContest(ctx context.Context, contestID model.ContestID, userID model.UserID, title, description string) (*model.Contest, error)
	}

	UpdateContestHandler struct {
		name    string
		service serviceUpdateContest
	}
)

func NewUpdateContestHandler(name string, service serviceUpdateContest) *UpdateContestHandler {
	return &UpdateContestHandler{name: name, service: service}
}

func (h *UpdateContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	
	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	// Get current contest to preserve fields
	contest, err := h.service.GetContest(r.Context(), contestID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	title := contest.Title
	if req.Title != nil {
		title = *req.Title
	}

	description := contest.Description
	if req.Description != nil {
		description = *req.Description
	}

	updated, err := h.service.UpdateContest(r.Context(), contestID, userID, title, description)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, updated); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
