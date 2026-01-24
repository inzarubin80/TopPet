package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
	"toppet/server/internal/service"
)

type (
	serviceGetCurrentUser interface {
		GetUserProfile(ctx context.Context, userID model.UserID) (*service.UserProfile, error)
	}

	GetCurrentUserHandler struct {
		name    string
		service serviceGetCurrentUser
	}
)

func NewGetCurrentUserHandler(name string, service serviceGetCurrentUser) *GetCurrentUserHandler {
	return &GetCurrentUserHandler{name: name, service: service}
}

func (h *GetCurrentUserHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	profile, err := h.service.GetUserProfile(r.Context(), userID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, profile.User); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
