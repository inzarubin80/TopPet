package app

import (
	"fmt"
	"os"
	"strconv"

	authinterface "toppet/server/internal/app/authinterface"
	appconfig "toppet/server/internal/app/config"
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

	// Base URL for og:url and og:image (e.g. https://top-pet.ru)
	BaseURL string
	// Path to built SPA index.html for meta-injected HTML (optional; when set, GET /contests/* return HTML with og/twitter meta)
	SPAIndexPath string
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

	cfg.BaseURL = envOr("BASE_URL", "https://top-pet.ru")
	cfg.SPAIndexPath = envOr("SPA_INDEX_PATH", "")

	// Initialize OAuth providers
	oauthProviders, err := appconfig.LoadOAuthProviders()
	if err != nil {
		// Log error but don't fail - app can work without OAuth providers
		fmt.Printf("Warning: Failed to load OAuth providers: %v\n", err)
		oauthProviders = make(authinterface.MapProviderOauthConf)
	}
	cfg.ProvidersConf = oauthProviders

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

// ValidateConfig проверяет корректность конфигурации
func ValidateConfig(cfg Config) error {
	if cfg.Addr == "" {
		return fmt.Errorf("ADDR is required")
	}

	if cfg.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	if cfg.AccessTokenSecret == "" {
		return fmt.Errorf("ACCESS_TOKEN_SECRET is required")
	}

	if cfg.RefreshTokenSecret == "" {
		return fmt.Errorf("REFRESH_TOKEN_SECRET is required")
	}

	if cfg.StoreSecret == "" {
		return fmt.Errorf("STORE_SECRET is required")
	}

	if cfg.AccessTokenTTLSec <= 0 {
		return fmt.Errorf("ACCESS_TOKEN_TTL_SEC must be positive")
	}

	if cfg.RefreshTokenTTLSec <= 0 {
		return fmt.Errorf("REFRESH_TOKEN_TTL_SEC must be positive")
	}

	return nil
}

