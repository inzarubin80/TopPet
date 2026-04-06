package middleware

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/model"
)

type (
	AuthMiddleware struct {
		h       http.Handler
		service serviceAuth
	}

	serviceAuth interface {
		Authorization(ctx context.Context, accessToken string) (*model.Claims, error)
		IsUserBlocked(ctx context.Context, userID model.UserID) (bool, error)
	}
)

func NewAuthMiddleware(h http.Handler, service serviceAuth) *AuthMiddleware {
	return &AuthMiddleware{h: h, service: service}
}

func (m *AuthMiddleware) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var accessToken string
	var err error

	accessToken, err = m.extractTokenFromHeader(r)

	if err != nil {
		http.Error(w, "Unauthorized not access token", http.StatusUnauthorized)
		return
	}

	claims, err := m.service.Authorization(ctx, accessToken)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	if isMutatingHTTPMethod(r.Method) {
		blocked, berr := m.service.IsUserBlocked(ctx, claims.UserID)
		if berr != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		if blocked {
			http.Error(w, "account is blocked", http.StatusForbidden)
			return
		}
	}

	ctx = context.WithValue(ctx, defenitions.UserID, claims.UserID)
	newRequest := r.WithContext(ctx)
	m.h.ServeHTTP(w, newRequest)
}

func isMutatingHTTPMethod(m string) bool {
	switch m {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func (m *AuthMiddleware) extractTokenFromHeader(r *http.Request) (string, error) {
	token := ""
	u, err := url.Parse(r.RequestURI)
	if err == nil {
		queryParams := u.Query()
		token = queryParams.Get("accessToken")
		if token != "" {
			return token, nil
		}
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", fmt.Errorf("отсутствует заголовок Authorization")
	}

	const prefix = "Bearer "
	if len(authHeader) < len(prefix) || authHeader[:len(prefix)] != prefix {
		return "", fmt.Errorf("неверный формат заголовка Authorization")
	}

	token = authHeader[len(prefix):]
	return token, nil
}
