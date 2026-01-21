package service

import (
	"context"
	"errors"
	"fmt"

	"toppet/server/internal/model"
)

// DevLogin creates a user by name and returns access + refresh tokens.
// This is a simplified login for MVP/development.
func (s *TopPetService) DevLogin(ctx context.Context, name string) (*model.AuthData, error) {
	if name == "" {
		return nil, errors.New("name is required")
	}

	// Create or get user (simplified: always create new for MVP)
	user, err := s.repository.CreateUser(ctx, name)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.refreshTokenService.GenerateToken(user.ID)
	if err != nil {
		return nil, err
	}

	accessToken, err := s.accessTokenService.GenerateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &model.AuthData{
		UserID:       user.ID,
		RefreshToken: refreshToken,
		AccessToken:  accessToken,
	}, nil
}

// Login performs OAuth login flow: exchange code for user data, create/find user, return tokens.
func (s *TopPetService) Login(ctx context.Context, providerKey string, authorizationCode string, codeVerifier string) (*model.AuthData, error) {
	provider, ok := s.providersUserData[providerKey]
	if !ok {
		return nil, fmt.Errorf("provider not found")
	}

	userProfileFromProvider, err := provider.GetUserData(ctx, authorizationCode, codeVerifier)
	if err != nil {
		return nil, err
	}

	userAuthProvider, err := s.repository.GetUserAuthProvidersByProviderUid(ctx, userProfileFromProvider.ProviderID, userProfileFromProvider.ProviderName)
	if err != nil && !errors.Is(err, model.ErrorNotFound) {
		return nil, err
	}

	var userID model.UserID
	if userAuthProvider == nil {
		// Create new user
		user, err := s.repository.CreateUserFromProvider(ctx, userProfileFromProvider)
		if err != nil {
			return nil, err
		}

		// Link auth provider
		_, err = s.repository.AddUserAuthProviders(ctx, userProfileFromProvider, user.ID)
		if err != nil {
			return nil, err
		}

		userID = user.ID
	} else {
		userID = userAuthProvider.UserID
	}

	// Set avatar if empty and provider returned one
	if userProfileFromProvider.AvatarURL != "" {
		_ = s.repository.SetUserAvatarIfEmpty(ctx, userID, &userProfileFromProvider.AvatarURL)
	}

	refreshToken, err := s.refreshTokenService.GenerateToken(userID)
	if err != nil {
		return nil, err
	}

	accessToken, err := s.accessTokenService.GenerateToken(userID)
	if err != nil {
		return nil, err
	}

	return &model.AuthData{
		UserID:       userID,
		RefreshToken: refreshToken,
		AccessToken:  accessToken,
	}, nil
}

// RefreshToken validates refresh token and issues new access + refresh tokens.
func (s *TopPetService) RefreshToken(ctx context.Context, refreshToken string) (*model.AuthData, error) {
	claims, err := s.refreshTokenService.ValidateToken(refreshToken)
	if err != nil {
		return nil, err
	}

	newAccessToken, err := s.accessTokenService.GenerateToken(claims.UserID)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := s.refreshTokenService.GenerateToken(claims.UserID)
	if err != nil {
		return nil, err
	}

	return &model.AuthData{
		UserID:       claims.UserID,
		RefreshToken: newRefreshToken,
		AccessToken:  newAccessToken,
	}, nil
}
