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
	servicePatchCurrentUser interface {
		PatchCurrentUser(ctx context.Context, userID model.UserID, p model.CurrentUserPatch) (*model.User, error)
	}

	UpdateCurrentUserHandler struct {
		name    string
		service servicePatchCurrentUser
	}
)

func NewUpdateCurrentUserHandler(name string, service servicePatchCurrentUser) *UpdateCurrentUserHandler {
	return &UpdateCurrentUserHandler{name: name, service: service}
}

func (h *UpdateCurrentUserHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	var req model.CurrentUserPatch
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	updated, err := h.service.PatchCurrentUser(r.Context(), userID, req)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, updated); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
