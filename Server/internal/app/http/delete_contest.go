package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceDeleteContest interface {
		DeleteContest(ctx context.Context, contestID model.ContestID, userID model.UserID) error
	}

	DeleteContestHandler struct {
		name    string
		service serviceDeleteContest
	}
)

func NewDeleteContestHandler(name string, service serviceDeleteContest) *DeleteContestHandler {
	return &DeleteContestHandler{name: name, service: service}
}

func (h *DeleteContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))

	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}

	err := h.service.DeleteContest(r.Context(), contestID, userID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type response struct {
		OK bool `json:"ok"`
	}

	resp := response{OK: true}
	if err := uhttp.SendSuccess(w, resp); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
