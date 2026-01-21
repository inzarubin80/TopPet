package http

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"net/url"

	"github.com/gorilla/sessions"
	authinterface "toppet/server/internal/app/authinterface"
	"toppet/server/internal/app/uhttp"
)

type StateData struct {
	CodeVerifier string
	Provider     string
	Action       string
	Expiry       time.Time
}

type LoginHandler struct {
	name              string
	provadersConf     authinterface.MapProviderOauthConf
	store             *sessions.CookieStore
	loginStateStore   map[string]StateData
	loginStateStoreMu *sync.Mutex
}

func NewLoginHandler(provadersConf authinterface.MapProviderOauthConf, name string, store *sessions.CookieStore, loginStateStore map[string]StateData, loginStateStoreMu *sync.Mutex) *LoginHandler {
	return &LoginHandler{
		name:              name,
		provadersConf:     provadersConf,
		store:             store,
		loginStateStore:   loginStateStore,
		loginStateStoreMu: loginStateStoreMu,
	}
}

func (h *LoginHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Provider      string `json:"provider"`
		CodeChallenge string `json:"code_challenge"`
		CodeVerifier  string `json:"code_verifier"`
		Action        string `json:"action"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Provider == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "provider required")
		return
	}

	cfg, ok := h.provadersConf[req.Provider]
	if !ok || cfg == nil || cfg.Oauth2Config == nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "unknown provider")
		return
	}

	state := randomURLSafe(24)

	if req.CodeChallenge == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "code_challenge required from client")
		return
	}
	if req.CodeVerifier == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "code_verifier required from client")
		return
	}
	challenge := req.CodeChallenge

	action := req.Action
	if action == "" {
		action = "login"
	}
	if action != "login" && action != "link" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "action must be 'login' or 'link'")
		return
	}

	h.loginStateStoreMu.Lock()
	h.loginStateStore[state] = StateData{
		CodeVerifier: req.CodeVerifier,
		Provider:     req.Provider,
		Action:       action,
		Expiry:       time.Now().Add(15 * time.Minute),
	}
	h.loginStateStoreMu.Unlock()

	apiRoot := os.Getenv("API_ROOT")
	if apiRoot == "" {
		apiRoot = "http://localhost:8080"
	}
	redirectURI := fmt.Sprintf("%s/api/auth/callback?provider=%s", apiRoot, req.Provider)

	scope := "login:info"
	if cfg.Oauth2Config != nil && len(cfg.Oauth2Config.Scopes) > 0 {
		scope = ""
		for i, s := range cfg.Oauth2Config.Scopes {
			if i > 0 {
				scope += " "
			}
			scope += s
		}
	}

	base := cfg.Oauth2Config.Endpoint.AuthURL
	q := make(url.Values)
	q.Set("client_id", cfg.Oauth2Config.ClientID)
	q.Set("response_type", "code")
	q.Set("redirect_uri", redirectURI)
	q.Set("scope", scope)
	q.Set("state", state)
	if challenge != "" {
		q.Set("code_challenge", challenge)
		q.Set("code_challenge_method", "S256")
	}

	authURL := base + "?" + q.Encode()

	resp := map[string]string{
		"auth_url": authURL,
		"state":    state,
	}
	b, err := json.Marshal(resp)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, "internal error")
		return
	}
	uhttp.SendSuccessfulResponse(w, b)
}

func randomURLSafe(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	s := base64.RawURLEncoding.EncodeToString(b)
	if len(s) > n {
		return s[:n]
	}
	return s
}
