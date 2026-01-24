package config

import (
	"fmt"
	"os"

	authinterface "toppet/server/internal/app/authinterface"
	providerUserData "toppet/server/internal/app/clients/provider_user_data"
	"toppet/server/internal/app/icons"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/yandex"
)

// LoadOAuthProviders загружает конфигурацию OAuth провайдеров из переменных окружения
func LoadOAuthProviders() (authinterface.MapProviderOauthConf, error) {
	providers := make(authinterface.MapProviderOauthConf)
	apiRoot := os.Getenv("API_ROOT")
	if apiRoot == "" {
		apiRoot = "http://localhost:8080"
	}

	// Yandex provider
	if clientID := os.Getenv("CLIENT_ID_YANDEX"); clientID != "" {
		clientSecret := os.Getenv("CLIENT_SECRET_YANDEX")
		if clientSecret == "" {
			return nil, fmt.Errorf("CLIENT_SECRET_YANDEX is required when CLIENT_ID_YANDEX is set")
		}

		providers["yandex"] = &authinterface.ProviderOauthConf{
			Oauth2Config: &oauth2.Config{
				ClientID:     clientID,
				ClientSecret: clientSecret,
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
					ClientSecret: clientSecret,
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
		clientSecret := os.Getenv("CLIENT_SECRET_GOOGLE")
		if clientSecret == "" {
			return nil, fmt.Errorf("CLIENT_SECRET_GOOGLE is required when CLIENT_ID_GOOGLE is set")
		}

		providers["google"] = &authinterface.ProviderOauthConf{
			Oauth2Config: &oauth2.Config{
				ClientID:     clientID,
				ClientSecret: clientSecret,
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
					ClientSecret: clientSecret,
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

	// VK provider
	if clientID := os.Getenv("CLIENT_ID_VK"); clientID != "" {
		clientSecret := os.Getenv("CLIENT_SECRET_VK")
		if clientSecret == "" {
			return nil, fmt.Errorf("CLIENT_SECRET_VK is required when CLIENT_ID_VK is set")
		}

		providers["vk"] = &authinterface.ProviderOauthConf{
			Oauth2Config: &oauth2.Config{
				ClientID:     clientID,
				ClientSecret: clientSecret,
				RedirectURL:  fmt.Sprintf("%s/api/auth/callback?provider=vk", apiRoot),
				Scopes:       []string{"email"},
				Endpoint: oauth2.Endpoint{
					AuthURL:  "https://oauth.vk.com/authorize",
					TokenURL: "https://oauth.vk.com/access_token",
				},
			},
			UrlUserData: "https://api.vk.com/method/users.get?fields=photo_200&v=5.131",
			IconSVG:     icons.GetProviderIcon("vk"),
			DisplayName: "VK",
			ProviderUserData: providerUserData.NewProviderUserData(
				"https://api.vk.com/method/users.get?fields=photo_200&v=5.131",
				&oauth2.Config{
					ClientID:     clientID,
					ClientSecret: clientSecret,
					RedirectURL:  fmt.Sprintf("%s/api/auth/callback?provider=vk", apiRoot),
					Scopes:       []string{"email"},
					Endpoint: oauth2.Endpoint{
						AuthURL:  "https://oauth.vk.com/authorize",
						TokenURL: "https://oauth.vk.com/access_token",
					},
				},
				"vk",
			),
		}
	}

	return providers, nil
}
