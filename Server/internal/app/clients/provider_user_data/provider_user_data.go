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
	
	// VK doesn't support PKCE, so we skip code_verifier for VK
	if p.provider == "vk" {
		token, err = p.oauthConfig.Exchange(ctx, authorizationCode)
	} else if codeVerifier != "" {
		token, err = p.oauthConfig.Exchange(ctx, authorizationCode, oauth2.SetAuthURLParam("code_verifier", codeVerifier))
	} else {
		token, err = p.oauthConfig.Exchange(ctx, authorizationCode)
	}
	if err != nil {
		return nil, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	var req *http.Request
	var response *http.Response

	// VK requires access_token in query params, not in Authorization header
	if p.provider == "vk" {
		urlWithToken := p.url + "&access_token=" + token.AccessToken
		req, err = http.NewRequestWithContext(reqCtx, "GET", urlWithToken, nil)
		if err != nil {
			return nil, err
		}
		client := &http.Client{Timeout: 60 * time.Second}
		response, err = client.Do(req)
	} else {
		client := p.oauthConfig.Client(ctx, token)
		if client.Timeout == 0 {
			client.Timeout = 60 * time.Second
		}
		req, err = http.NewRequestWithContext(reqCtx, "GET", p.url, nil)
		if err != nil {
			return nil, err
		}
		response, err = client.Do(req)
	}

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
	case "vk":
		// Extract email from token if available (VK returns email in token response)
		email := ""
		if token.Extra("email") != nil {
			if emailStr, ok := token.Extra("email").(string); ok {
				email = emailStr
			}
		}
		return p.parseVKProfile(profile, email)
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

func (p *ProviderUserData) parseVKProfile(profile map[string]interface{}, email string) (*model.UserProfileFromProvider, error) {
	// VK API returns data in format: {"response": [{"id": ..., "first_name": ..., "last_name": ..., "photo_200": ...}]}
	response, ok := profile["response"].([]interface{})
	if !ok || len(response) == 0 {
		return nil, fmt.Errorf("invalid VK profile format: missing response array")
	}

	userDataMap, ok := response[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid VK profile format: response[0] is not a map")
	}

	providerIDFloat, ok := userDataMap["id"].(float64)
	if !ok {
		return nil, fmt.Errorf("invalid VK profile format: missing id")
	}
	providerID := fmt.Sprintf("%.0f", providerIDFloat)

	firstName, _ := userDataMap["first_name"].(string)
	lastName, _ := userDataMap["last_name"].(string)
	avatarURL, _ := userDataMap["photo_200"].(string)

	displayName := ""
	if firstName != "" && lastName != "" {
		displayName = fmt.Sprintf("%s %s", firstName, lastName)
	} else if firstName != "" {
		displayName = firstName
	} else if lastName != "" {
		displayName = lastName
	}

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
