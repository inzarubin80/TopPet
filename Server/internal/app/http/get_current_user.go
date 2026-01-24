package http

import (
	"context"
	"encoding/json"
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
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonData, _ := json.Marshal(profile.User)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
