package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/model"
)

var profileEmailFormat = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

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

// PatchCurrentUser применяет частичное обновление профиля (имя, email, телефон, дата рождения, URL аватара).
func (s *TopPetService) PatchCurrentUser(ctx context.Context, userID model.UserID, p model.CurrentUserPatch) (*model.User, error) {
	if p.Name == nil && p.Email == nil && p.Phone == nil && p.DateOfBirth == nil && p.AvatarURL == nil {
		return nil, fmt.Errorf("%w: no fields to update", model.ErrBadRequest)
	}

	cur, err := s.repository.GetUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	out := *cur
	if p.Name != nil {
		t := strings.TrimSpace(*p.Name)
		if t == "" {
			return nil, fmt.Errorf("%w: name cannot be empty", model.ErrBadRequest)
		}
		out.Name = t
	}
	if p.Email != nil {
		raw := strings.TrimSpace(*p.Email)
		if raw == "" {
			out.Email = ""
		} else if !profileEmailFormat.MatchString(raw) {
			return nil, fmt.Errorf("%w: invalid email", model.ErrBadRequest)
		} else {
			out.Email = raw
		}
	}
	if p.Phone != nil {
		out.Phone = strings.TrimSpace(*p.Phone)
	}
	if p.DateOfBirth != nil {
		raw := strings.TrimSpace(*p.DateOfBirth)
		if raw == "" {
			out.DateOfBirth = nil
		} else {
			t, perr := time.ParseInLocation("2006-01-02", raw, time.UTC)
			if perr != nil {
				return nil, fmt.Errorf("%w: date_of_birth must be YYYY-MM-DD", model.ErrBadRequest)
			}
			out.DateOfBirth = &t
		}
	}
	if p.AvatarURL != nil {
		out.AvatarURL = strings.TrimSpace(*p.AvatarURL)
	}

	return s.repository.UpdateUserProfile(ctx, userID, &out)
}

// DeleteCurrentUserAccount удаляет аккаунт текущего пользователя и связанные данные (провайдеры OAuth, заявки, сообщения чата и т.д.).
func (s *TopPetService) DeleteCurrentUserAccount(ctx context.Context, userID model.UserID) error {
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	u, err := s.repository.GetUser(dbCtx, userID)
	if err != nil {
		return err
	}
	role := u.Role
	if role == "" {
		role = model.UserRoleUser
	}
	if role == model.UserRoleSystemAdmin {
		n, err := s.repository.CountSystemAdmins(dbCtx)
		if err != nil {
			return err
		}
		if n <= 1 {
			return model.ErrLastSystemAdmin
		}
	}

	return s.repository.DeleteUserAccount(dbCtx, userID)
}
