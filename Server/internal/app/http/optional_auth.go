package http

import (
	"context"
	"net/http"
	"net/url"
	"strings"

	"toppet/server/internal/model"
)

type serviceOptionalAuth interface {
	Authorization(ctx context.Context, accessToken string) (*model.Claims, error)
}

func extractAccessToken(r *http.Request) string {
	if r == nil {
		return ""
	}

	u, err := url.Parse(r.RequestURI)
	if err == nil {
		if token := u.Query().Get("accessToken"); token != "" {
			return token
		}
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	const prefix = "Bearer "
	if !strings.HasPrefix(authHeader, prefix) {
		return ""
	}

	return strings.TrimSpace(authHeader[len(prefix):])
}

func getOptionalUserID(r *http.Request, authService serviceOptionalAuth) (model.UserID, bool, error) {
	if authService == nil {
		return 0, false, nil
	}

	token := extractAccessToken(r)
	if token == "" {
		return 0, false, nil
	}

	claims, err := authService.Authorization(r.Context(), token)
	if err != nil {
		return 0, false, err
	}

	return claims.UserID, true, nil
}
