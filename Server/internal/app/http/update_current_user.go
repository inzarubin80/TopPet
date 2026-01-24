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
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	if req.Name == nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "name is required")
		return
	}

	updated, err := h.service.UpdateUserName(r.Context(), userID, *req.Name)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(updated)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
