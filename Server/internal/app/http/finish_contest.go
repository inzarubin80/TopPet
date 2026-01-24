package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceFinishContest interface {
		FinishContest(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Contest, error)
	}

	FinishContestHandler struct {
		name    string
		service serviceFinishContest
	}
)

func NewFinishContestHandler(name string, service serviceFinishContest) *FinishContestHandler {
	return &FinishContestHandler{name: name, service: service}
}

func (h *FinishContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))

	contest, err := h.service.FinishContest(r.Context(), contestID, userID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, contest); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
