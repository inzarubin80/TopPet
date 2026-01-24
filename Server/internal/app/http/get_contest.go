package http

import (
	"context"
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
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}

	contest, err := h.service.GetContest(r.Context(), contestID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if contest.Status == model.ContestStatusDraft {
		userID, ok, authErr := getOptionalUserID(r, h.authService)
		if authErr != nil {
			uhttp.HandleError(w, uhttp.NewUnauthorizedError("authentication required", authErr))
			return
		}
		if !ok || contest.CreatedByUserID != userID {
			uhttp.HandleError(w, uhttp.NewNotFoundError("contest not found", nil))
			return
		}
	}

	if err := uhttp.SendSuccess(w, contest); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
