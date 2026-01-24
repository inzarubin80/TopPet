package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"toppet/server/internal/model"
)

type UserProfile struct {
	User      *model.User              `json:"user"`
	Providers []*model.UserAuthProvider `json:"providers"`
}

func (s *TopPetService) GetUserProfile(ctx context.Context, userID model.UserID) (*UserProfile, error) {
	// Get user
	user, err := s.repository.GetUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Get user's auth providers
	providers, err := s.repository.GetUserAuthProvidersByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &UserProfile{
		User:      user,
		Providers: providers,
	}, nil
}

func (s *TopPetService) LinkAuthProvider(ctx context.Context, userID model.UserID, userData *model.UserProfileFromProvider) (*model.UserAuthProvider, error) {
	// Check if provider is already linked
	existingProvider, err := s.repository.GetUserAuthProvidersByProviderUid(ctx, userData.ProviderID, userData.ProviderName)
	if err == nil {
		// Provider already exists
		if existingProvider.UserID == userID {
			// Already linked to this user - return existing
			return existingProvider, nil
		}
		// Linked to another user - cannot link
		return nil, fmt.Errorf("provider already linked to another account")
	}

	// Provider not found - can link it
	if !errors.Is(err, model.ErrorNotFound) {
		// Some other error occurred
		return nil, err
	}

	// Add provider to user
	authProvider, err := s.repository.AddUserAuthProviders(ctx, userData, userID)
	if err != nil {
		return nil, err
	}

	// Set avatar if empty
	if userData.AvatarURL != "" {
		avatarURL := userData.AvatarURL
		_ = s.repository.SetUserAvatarIfEmpty(ctx, userID, &avatarURL)
	}

	return authProvider, nil
}

func (s *TopPetService) UpdateUserName(ctx context.Context, userID model.UserID, name string) (*model.User, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, errors.New("name is required")
	}
	return s.repository.UpdateUserName(ctx, userID, trimmed)
}
