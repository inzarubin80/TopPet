package config

import (
	"os"
	"testing"
)

func TestLoadOAuthProviders_skipsProviderWhenSecretMissing(t *testing.T) {
	t.Setenv("API_ROOT", "http://localhost:8080")
	t.Setenv("CLIENT_ID_YANDEX", "")
	t.Setenv("CLIENT_SECRET_YANDEX", "")
	t.Setenv("CLIENT_ID_GOOGLE", "google-id-without-secret")
	t.Setenv("CLIENT_SECRET_GOOGLE", "")
	t.Setenv("CLIENT_ID_VK", "")
	t.Setenv("CLIENT_SECRET_VK", "")

	p := LoadOAuthProviders()
	if len(p) != 0 {
		t.Fatalf("expected no providers when only misconfigured google id is set, got %d", len(p))
	}
}

func TestLoadOAuthProviders_yandexStillLoadsWhenGoogleMisconfigured(t *testing.T) {
	t.Setenv("API_ROOT", "http://localhost:8080")
	t.Setenv("CLIENT_ID_YANDEX", "yandex-id")
	t.Setenv("CLIENT_SECRET_YANDEX", "yandex-secret")
	t.Setenv("CLIENT_ID_GOOGLE", "google-id")
	t.Setenv("CLIENT_SECRET_GOOGLE", "")
	t.Setenv("CLIENT_ID_VK", "")
	t.Setenv("CLIENT_SECRET_VK", "")

	p := LoadOAuthProviders()
	if _, ok := p["yandex"]; !ok {
		t.Fatal("expected yandex to be registered")
	}
	if _, ok := p["google"]; ok {
		t.Fatal("expected google to be skipped when secret missing")
	}
}

func TestLoadOAuthProviders_googleWhenFullyConfigured(t *testing.T) {
	t.Setenv("API_ROOT", "http://localhost:8080")
	t.Setenv("CLIENT_ID_YANDEX", "")
	t.Setenv("CLIENT_SECRET_YANDEX", "")
	t.Setenv("CLIENT_ID_GOOGLE", "g-id")
	t.Setenv("CLIENT_SECRET_GOOGLE", "g-secret")
	t.Setenv("CLIENT_ID_VK", "")
	t.Setenv("CLIENT_SECRET_VK", "")

	p := LoadOAuthProviders()
	g, ok := p["google"]
	if !ok || g == nil || g.Oauth2Config == nil {
		t.Fatal("expected google provider")
	}
	if g.Oauth2Config.RedirectURL != "http://localhost:8080/api/auth/callback?provider=google" {
		t.Fatalf("redirect: %s", g.Oauth2Config.RedirectURL)
	}
}

func TestMain(m *testing.M) {
	// Clear OAuth env from parent process so tests control configuration.
	for _, k := range []string{
		"CLIENT_ID_YANDEX", "CLIENT_SECRET_YANDEX",
		"CLIENT_ID_GOOGLE", "CLIENT_SECRET_GOOGLE",
		"CLIENT_ID_VK", "CLIENT_SECRET_VK",
		"YANDEX_OAUTH_SCOPES",
	} {
		_ = os.Unsetenv(k)
	}
	os.Exit(m.Run())
}
