package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceDeleteCurrentUser interface {
		DeleteCurrentUserAccount(ctx context.Context, userID model.UserID) error
	}

	DeleteCurrentUserHandler struct {
		name    string
		service serviceDeleteCurrentUser
	}
)

func NewDeleteCurrentUserHandler(name string, service serviceDeleteCurrentUser) *DeleteCurrentUserHandler {
	return &DeleteCurrentUserHandler{name: name, service: service}
}

func (h *DeleteCurrentUserHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	if err := h.service.DeleteCurrentUserAccount(r.Context(), userID); err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type response struct {
		OK bool `json:"ok"`
	}
	if err := uhttp.SendSuccess(w, response{OK: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
