package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceDevLogin interface {
		DevLogin(ctx context.Context, name string) (*model.AuthData, error)
	}

	DevLoginHandler struct {
		name    string
		service serviceDevLogin
	}
)

func NewDevLoginHandler(service serviceDevLogin, name string) *DevLoginHandler {
	return &DevLoginHandler{
		name:    name,
		service: service,
	}
}

func (h *DevLoginHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	if req.Name == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "name is required")
		return
	}

	authData, err := h.service.DevLogin(r.Context(), req.Name)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	type response struct {
		Token        string       `json:"token"`
		RefreshToken string       `json:"refresh_token"`
		UserID       model.UserID `json:"user_id"`
	}

	resp := response{
		Token:        authData.AccessToken,
		RefreshToken: authData.RefreshToken,
		UserID:       authData.UserID,
	}

	jsonData, err := json.Marshal(resp)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	uhttp.SendSuccessfulResponse(w, jsonData)
}
