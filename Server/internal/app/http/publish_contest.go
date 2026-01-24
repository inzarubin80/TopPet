package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	servicePublishContest interface {
		PublishContest(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Contest, error)
	}

	PublishContestHandler struct {
		name    string
		service servicePublishContest
	}
)

func NewPublishContestHandler(name string, service servicePublishContest) *PublishContestHandler {
	return &PublishContestHandler{name: name, service: service}
}

func (h *PublishContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))

	contest, err := h.service.PublishContest(r.Context(), contestID, userID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, contest); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
