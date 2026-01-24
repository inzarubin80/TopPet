package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceCreateContest interface {
		CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
	}

	CreateContestHandler struct {
		*BaseHandler
		service serviceCreateContest
	}
)

func NewCreateContestHandler(name string, service serviceCreateContest) *CreateContestHandler {
	return &CreateContestHandler{
		BaseHandler: NewBaseHandler(name),
		service:     service,
	}
}

func (h *CreateContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}

	if err := h.ParseJSON(r, &req); err != nil {
		h.HandleError(w, err)
		return
	}

	contest, err := h.service.CreateContest(r.Context(), userID, req.Title, req.Description)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	if err := h.SendSuccess(w, contest); err != nil {
		h.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
