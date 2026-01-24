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
	serviceUpdateCurrentUser interface {
		UpdateUserName(ctx context.Context, userID model.UserID, name string) (*model.User, error)
	}

	UpdateCurrentUserHandler struct {
		name    string
		service serviceUpdateCurrentUser
	}
)

func NewUpdateCurrentUserHandler(name string, service serviceUpdateCurrentUser) *UpdateCurrentUserHandler {
	return &UpdateCurrentUserHandler{name: name, service: service}
}

func (h *UpdateCurrentUserHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	var req struct {
		Name *string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	if req.Name == nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("name is required", nil))
		return
	}

	updated, err := h.service.UpdateUserName(r.Context(), userID, *req.Name)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, updated); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
