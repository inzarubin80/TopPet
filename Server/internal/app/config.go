package app

import (
	"fmt"
	"os"
	"strconv"

	authinterface "toppet/server/internal/app/authinterface"
	providerUserData "toppet/server/internal/app/clients/provider_user_data"
	"toppet/server/internal/app/icons"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/yandex"
)

type Config struct {
	Addr        string
	DatabaseURL string

	AccessTokenSecret  string
	RefreshTokenSecret string
	AccessTokenTTLSec  int
	RefreshTokenTTLSec int
	StoreSecret        string

	// Yandex Object Storage (S3 compatible)
	S3Endpoint  string
	S3AccessKey string
	S3SecretKey string
	S3Bucket    string
	S3CDNBase   string
	S3Secure    bool

	CorsAllowedOrigins []string
	ProvidersConf      authinterface.MapProviderOauthConf
}

func LoadConfigFromEnv() Config {
	cfg := Config{
		Addr:              envOr("ADDR", ":8080"),
		DatabaseURL:       envOr("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/toppet?sslmode=disable"),
		AccessTokenSecret: envOr("ACCESS_TOKEN_SECRET", "dev-access-secret"),
		RefreshTokenSecret: envOr("REFRESH_TOKEN_SECRET", "dev-refresh-secret"),
		AccessTokenTTLSec:  envOrInt("ACCESS_TOKEN_TTL_SEC", 300),
		RefreshTokenTTLSec: envOrInt("REFRESH_TOKEN_TTL_SEC", 30*24*3600),
		StoreSecret:        envOr("STORE_SECRET", "dev-store-secret-change-in-production"),

		S3Endpoint:  envOr("S3_ENDPOINT", ""),
		S3AccessKey: envOr("S3_ACCESS_KEY", ""),
		S3SecretKey: envOr("S3_SECRET_KEY", ""),
		S3Bucket:    envOr("S3_BUCKET", ""),
		S3CDNBase:   envOr("S3_CDN_BASE_URL", ""),
		S3Secure:    envOrBool("S3_SECURE", true),
	}

	// Comma-separated
	cfg.CorsAllowedOrigins = splitComma(envOr("CORS_ALLOWED_ORIGINS", "http://localhost:3000"))

	// Initialize OAuth providers
	provaders := make(authinterface.MapProviderOauthConf)
	apiRoot := os.Getenv("API_ROOT")
	if apiRoot == "" {
		apiRoot = "http://localhost:8080"
	}

	// Yandex provider
	if clientID := os.Getenv("CLIENT_ID_YANDEX"); clientID != "" {
		provaders["yandex"] = &authinterface.ProviderOauthConf{
			Oauth2Config: &oauth2.Config{
				ClientID:     clientID,
				ClientSecret: os.Getenv("CLIENT_SECRET_YANDEX"),
				RedirectURL:  fmt.Sprintf("%s/api/auth/callback?provider=yandex", apiRoot),
				Scopes:       []string{"login:info"},
				Endpoint:     yandex.Endpoint,
			},
			UrlUserData: "https://login.yandex.ru/info?format=json",
			IconSVG:     icons.GetProviderIcon("yandex"),
			DisplayName: "Яндекс",
			ProviderUserData: providerUserData.NewProviderUserData(
				"https://login.yandex.ru/info?format=json",
				&oauth2.Config{
					ClientID:     clientID,
					ClientSecret: os.Getenv("CLIENT_SECRET_YANDEX"),
					RedirectURL:  fmt.Sprintf("%s/api/auth/callback?provider=yandex", apiRoot),
					Scopes:       []string{"login:info"},
					Endpoint:     yandex.Endpoint,
				},
				"yandex",
			),
		}
	}

	// Google provider
	if clientID := os.Getenv("CLIENT_ID_GOOGLE"); clientID != "" {
		provaders["google"] = &authinterface.ProviderOauthConf{
			Oauth2Config: &oauth2.Config{
				ClientID:     clientID,
				ClientSecret: os.Getenv("CLIENT_SECRET_GOOGLE"),
				RedirectURL:  fmt.Sprintf("%s/api/auth/callback?provider=google", apiRoot),
				Scopes:       []string{"openid", "email", "profile"},
				Endpoint: oauth2.Endpoint{
					AuthURL:  "https://accounts.google.com/o/oauth2/auth",
					TokenURL: "https://oauth2.googleapis.com/token",
				},
			},
			UrlUserData: "https://www.googleapis.com/oauth2/v2/userinfo",
			IconSVG:     icons.GetProviderIcon("google"),
			DisplayName: "Google",
			ProviderUserData: providerUserData.NewProviderUserData(
				"https://www.googleapis.com/oauth2/v2/userinfo",
				&oauth2.Config{
					ClientID:     clientID,
					ClientSecret: os.Getenv("CLIENT_SECRET_GOOGLE"),
					RedirectURL:  fmt.Sprintf("%s/api/auth/callback?provider=google", apiRoot),
					Scopes:       []string{"openid", "email", "profile"},
					Endpoint: oauth2.Endpoint{
						AuthURL:  "https://accounts.google.com/o/oauth2/auth",
						TokenURL: "https://oauth2.googleapis.com/token",
					},
				},
				"google",
			),
		}
	}

	cfg.ProvidersConf = provaders
	return cfg
}

func envOr(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func envOrInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func envOrBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func splitComma(v string) []string {
	out := []string{}
	cur := ""
	for i := 0; i < len(v); i++ {
		if v[i] == ',' {
			if cur != "" {
				out = append(out, trimSpaces(cur))
			}
			cur = ""
			continue
		}
		cur += string(v[i])
	}
	if cur != "" {
		out = append(out, trimSpaces(cur))
	}
	return out
}

func trimSpaces(s string) string {
	i := 0
	j := len(s) - 1
	for i < len(s) && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r') {
		i++
	}
	for j >= 0 && (s[j] == ' ' || s[j] == '\t' || s[j] == '\n' || s[j] == '\r') {
		j--
	}
	if j < i {
		return ""
	}
	return s[i : j+1]
}

