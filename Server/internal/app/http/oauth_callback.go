package http

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/sessions"
	authinterface "toppet/server/internal/app/authinterface"
	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/model"
)

type OAuthCallbackHandler struct {
	name              string
	provadersConf     authinterface.MapProviderOauthConf
	store             *sessions.CookieStore
	loginStateStore   map[string]StateData
	loginStateStoreMu *sync.Mutex
	service           serviceLogin
}

type serviceLogin interface {
	Login(ctx context.Context, providerKey string, authorizationCode string, codeVerifier string) (*model.AuthData, error)
}

func NewOAuthCallbackHandler(
	provadersConf authinterface.MapProviderOauthConf,
	name string,
	store *sessions.CookieStore,
	loginStateStore map[string]StateData,
	loginStateStoreMu *sync.Mutex,
	service serviceLogin,
) *OAuthCallbackHandler {
	return &OAuthCallbackHandler{
		name:              name,
		provadersConf:     provadersConf,
		store:             store,
		loginStateStore:   loginStateStore,
		loginStateStoreMu: loginStateStoreMu,
		service:           service,
	}
}

func (h *OAuthCallbackHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	provider := r.URL.Query().Get("provider")
	errorParam := r.URL.Query().Get("error")
	errorDescription := r.URL.Query().Get("error_description")

	if errorParam != "" {
		mobileRedirect := fmt.Sprintf("toppet://auth/callback?provider=%s&error=%s", provider, url.QueryEscape(errorParam))
		if errorDescription != "" {
			mobileRedirect += fmt.Sprintf("&error_description=%s", url.QueryEscape(errorDescription))
		}
		http.Redirect(w, r, mobileRedirect, http.StatusFound)
		return
	}

	if code == "" || state == "" {
		mobileRedirect := fmt.Sprintf("toppet://auth/callback?provider=%s&error=invalid_request&error_description=%s",
			provider, url.QueryEscape("missing_code_or_state"))
		http.Redirect(w, r, mobileRedirect, http.StatusFound)
		return
	}

	h.loginStateStoreMu.Lock()
	stateInfo, ok := h.loginStateStore[state]
	if !ok {
		h.loginStateStoreMu.Unlock()
		mobileRedirect := fmt.Sprintf("toppet://auth/callback?provider=%s&error=invalid_state&error_description=%s",
			provider, url.QueryEscape("state_not_found"))
		http.Redirect(w, r, mobileRedirect, http.StatusFound)
		return
	}

	if time.Now().After(stateInfo.Expiry) {
		delete(h.loginStateStore, state)
		h.loginStateStoreMu.Unlock()
		mobileRedirect := fmt.Sprintf("toppet://auth/callback?provider=%s&error=expired_state&error_description=%s",
			provider, url.QueryEscape("state_expired"))
		http.Redirect(w, r, mobileRedirect, http.StatusFound)
		return
	}

	if stateInfo.Provider != provider {
		delete(h.loginStateStore, state)
		h.loginStateStoreMu.Unlock()
		mobileRedirect := fmt.Sprintf("toppet://auth/callback?provider=%s&error=invalid_provider&error_description=%s",
			provider, url.QueryEscape("provider_mismatch"))
		http.Redirect(w, r, mobileRedirect, http.StatusFound)
		return
	}

	codeVerifier := stateInfo.CodeVerifier
	action := stateInfo.Action
	if action == "" {
		action = "login"
	}
	delete(h.loginStateStore, state)
	h.loginStateStoreMu.Unlock()

	if action == "link" {
		// Link provider - requires active session
		session, err := h.store.Get(r, defenitions.SessionAuthenticationName)
		if err != nil {
			mobileRedirect := fmt.Sprintf("toppet://auth/callback?action=link&provider=%s&error=unauthorized&error_description=%s",
				provider, url.QueryEscape("session_not_found"))
			http.Redirect(w, r, mobileRedirect, http.StatusFound)
			return
		}

		userIDValue := session.Values[defenitions.UserID]
		if userIDValue == nil {
			mobileRedirect := fmt.Sprintf("toppet://auth/callback?action=link&provider=%s&error=unauthorized&error_description=%s",
				provider, url.QueryEscape("user_not_authenticated"))
			http.Redirect(w, r, mobileRedirect, http.StatusFound)
			return
		}

		// For now, link is not implemented - just redirect with error
		mobileRedirect := fmt.Sprintf("toppet://auth/callback?action=link&provider=%s&error=not_implemented",
			provider)
		http.Redirect(w, r, mobileRedirect, http.StatusFound)
		return
	}

	// Regular login
	authData, err := h.service.Login(r.Context(), provider, code, codeVerifier)
	if err != nil {
		mobileRedirect := fmt.Sprintf("toppet://auth/callback?provider=%s&error=exchange_failed&error_description=%s",
			provider, url.QueryEscape(err.Error()))
		http.Redirect(w, r, mobileRedirect, http.StatusFound)
		return
	}

	// Save session
	session, err := h.store.Get(r, defenitions.SessionAuthenticationName)
	if err == nil {
		session.Values[defenitions.Token] = authData.RefreshToken
		session.Values[defenitions.UserID] = int64(authData.UserID)
		session.Save(r, w)
	}

	// Redirect to mobile app with tokens
	mobileRedirect := fmt.Sprintf("toppet://auth/callback?provider=%s&access_token=%s&refresh_token=%s&user_id=%d",
		provider, url.QueryEscape(authData.AccessToken), url.QueryEscape(authData.RefreshToken), authData.UserID)
	http.Redirect(w, r, mobileRedirect, http.StatusFound)
}
