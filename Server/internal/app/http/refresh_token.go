package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceRefreshToken interface {
		RefreshToken(ctx context.Context, refreshToken string) (*model.AuthData, error)
	}

	RefreshTokenHandler struct {
		name    string
		service serviceRefreshToken
	}
)

func NewRefreshTokenHandler(service serviceRefreshToken, name string) *RefreshTokenHandler {
	return &RefreshTokenHandler{
		name:    name,
		service: service,
	}
}

func (h *RefreshTokenHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		RefreshToken string `json:"refresh_token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	if req.RefreshToken == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	authData, err := h.service.RefreshToken(ctx, req.RefreshToken)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusUnauthorized, err.Error())
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
