package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceGetContest interface {
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
	}

	GetContestHandler struct {
		name        string
		service     serviceGetContest
		authService serviceOptionalAuth
	}
)

func NewGetContestHandler(name string, service serviceGetContest) *GetContestHandler {
	var authService serviceOptionalAuth
	if svc, ok := service.(serviceOptionalAuth); ok {
		authService = svc
	}

	return &GetContestHandler{name: name, service: service, authService: authService}
}

func (h *GetContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "contestId is required")
		return
	}

	contest, err := h.service.GetContest(r.Context(), contestID)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}

	if contest.Status == model.ContestStatusDraft {
		userID, ok, authErr := getOptionalUserID(r, h.authService)
		if authErr != nil {
			uhttp.SendErrorResponse(w, http.StatusUnauthorized, authErr.Error())
			return
		}
		if !ok || contest.CreatedByUserID != userID {
			uhttp.SendErrorResponse(w, http.StatusNotFound, "contest not found")
			return
		}
	}

	jsonData, _ := json.Marshal(contest)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
