package provideruserdata

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"toppet/server/internal/model"
	"golang.org/x/oauth2"
)

type ProviderUserData struct {
	url         string
	oauthConfig *oauth2.Config
	provider    string
}

func NewProviderUserData(url string, oauthConfig *oauth2.Config, provider string) *ProviderUserData {
	return &ProviderUserData{
		url:         url,
		oauthConfig: oauthConfig,
		provider:    provider,
	}
}

func (p *ProviderUserData) GetUserData(ctx context.Context, authorizationCode string, codeVerifier string) (*model.UserProfileFromProvider, error) {
	var token *oauth2.Token
	var err error
	if codeVerifier != "" {
		token, err = p.oauthConfig.Exchange(ctx, authorizationCode, oauth2.SetAuthURLParam("code_verifier", codeVerifier))
	} else {
		token, err = p.oauthConfig.Exchange(ctx, authorizationCode)
	}
	if err != nil {
		return nil, err
	}

	client := p.oauthConfig.Client(ctx, token)
	if client.Timeout == 0 {
		client.Timeout = 60 * time.Second
	}

	reqCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", p.url, nil)
	if err != nil {
		return nil, err
	}

	response, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	var profile map[string]interface{}
	if err := json.NewDecoder(response.Body).Decode(&profile); err != nil {
		return nil, err
	}

	switch p.provider {
	case "yandex":
		return p.parseYandexProfile(profile)
	case "google":
		return p.parseGoogleProfile(profile)
	default:
		return p.parseDefaultProfile(profile)
	}
}

func (p *ProviderUserData) parseYandexProfile(profile map[string]interface{}) (*model.UserProfileFromProvider, error) {
	displayName, _ := profile["real_name"].(string)
	providerID, _ := profile["id"].(string)
	defaultEmail, _ := profile["default_email"].(string)
	firstName, _ := profile["first_name"].(string)
	lastName, _ := profile["last_name"].(string)
	avatarURL, _ := profile["default_avatar_id"].(string)

	userData := &model.UserProfileFromProvider{
		Name:         displayName,
		ProviderID:   providerID,
		ProviderName: p.provider,
		Email:        defaultEmail,
		FirstName:    firstName,
		LastName:     lastName,
		AvatarURL:    avatarURL,
	}

	return userData, nil
}

func (p *ProviderUserData) parseGoogleProfile(profile map[string]interface{}) (*model.UserProfileFromProvider, error) {
	displayName, _ := profile["name"].(string)
	providerID, _ := profile["id"].(string)
	email, _ := profile["email"].(string)
	picture, _ := profile["picture"].(string)
	firstName, _ := profile["given_name"].(string)
	lastName, _ := profile["family_name"].(string)

	if displayName == "" {
		if firstName != "" && lastName != "" {
			displayName = fmt.Sprintf("%s %s", firstName, lastName)
		} else if firstName != "" {
			displayName = firstName
		} else if lastName != "" {
			displayName = lastName
		}
	}

	userData := &model.UserProfileFromProvider{
		Name:         displayName,
		ProviderID:   providerID,
		ProviderName: p.provider,
		Email:        email,
		FirstName:    firstName,
		LastName:     lastName,
		AvatarURL:    picture,
	}

	return userData, nil
}

func (p *ProviderUserData) parseDefaultProfile(profile map[string]interface{}) (*model.UserProfileFromProvider, error) {
	displayName, _ := profile["name"].(string)
	providerID, _ := profile["id"].(string)
	email, _ := profile["email"].(string)
	firstName, _ := profile["first_name"].(string)
	lastName, _ := profile["last_name"].(string)
	avatarURL, _ := profile["avatar_url"].(string)

	userData := &model.UserProfileFromProvider{
		Name:         displayName,
		ProviderID:   providerID,
		ProviderName: p.provider,
		Email:        email,
		FirstName:    firstName,
		LastName:     lastName,
		AvatarURL:    avatarURL,
	}

	return userData, nil
}
