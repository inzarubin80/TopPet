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
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "contestId is required")
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	// Get current contest to preserve fields
	contest, err := h.service.GetContest(r.Context(), contestID)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusNotFound, err.Error())
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
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(updated)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
