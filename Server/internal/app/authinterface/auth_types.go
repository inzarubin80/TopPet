package authinterface

import (
	"context"

	"toppet/server/internal/model"
	"golang.org/x/oauth2"
)

type (
	ProviderUserData interface {
		GetUserData(ctx context.Context, authorizationCode string, codeVerifier string) (*model.UserProfileFromProvider, error)
	}

	ProvidersUserData map[string]ProviderUserData

	ProviderOauthConf struct {
		Oauth2Config     *oauth2.Config
		UrlUserData      string
		IconSVG          string
		DisplayName      string
		ProviderUserData ProviderUserData
	}

	MapProviderOauthConf map[string]*ProviderOauthConf

	ProviderOauthConfFrontend struct {
		Provider   string `json:"provider"`
		IconSVG    string `json:"icon_svg"`
		Name       string `json:"name"`
	}
)
