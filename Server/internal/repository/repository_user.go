package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func (r *Repository) CreateUser(ctx context.Context, name string) (*model.User, error) {
	reposqlc := sqlc_repository.New(r.conn)
	user, err := reposqlc.CreateUser(ctx, name)
	if err != nil {
		return nil, err
	}

	return &model.User{
		ID:        model.UserID(user.UserID),
		Name:      user.Name,
		CreatedAt: user.CreatedAt.Time,
	}, nil
}

func (r *Repository) CreateUserFromProvider(ctx context.Context, userData *model.UserProfileFromProvider) (*model.User, error) {
	reposqlc := sqlc_repository.New(r.conn)
	
	name := userData.Name
	if name == "" {
		if userData.FirstName != "" && userData.LastName != "" {
			name = userData.FirstName + " " + userData.LastName
		} else if userData.FirstName != "" {
			name = userData.FirstName
		} else if userData.LastName != "" {
			name = userData.LastName
		} else if userData.Email != "" {
			name = userData.Email
		} else {
			name = "User"
		}
	}

	user, err := reposqlc.CreateUser(ctx, name)
	if err != nil {
		return nil, err
	}

	return &model.User{
		ID:        model.UserID(user.UserID),
		Name:      user.Name,
		CreatedAt: user.CreatedAt.Time,
	}, nil
}

func (r *Repository) GetUserAuthProvidersByProviderUid(ctx context.Context, providerUID, provider string) (*model.UserAuthProvider, error) {
	reposqlc := sqlc_repository.New(r.conn)
	authProvider, err := reposqlc.GetUserAuthProvidersByProviderUid(ctx, &sqlc_repository.GetUserAuthProvidersByProviderUidParams{
		ProviderUid: providerUID,
		Provider:    provider,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	result := &model.UserAuthProvider{
		UserID:     model.UserID(authProvider.UserID),
		ProviderUID: authProvider.ProviderUid,
		Provider:   authProvider.Provider,
	}
	if authProvider.Name != nil {
		result.Name = authProvider.Name
	}

	return result, nil
}

func (r *Repository) AddUserAuthProviders(ctx context.Context, userData *model.UserProfileFromProvider, userID model.UserID) (*model.UserAuthProvider, error) {
	reposqlc := sqlc_repository.New(r.conn)
	
	var name *string
	if userData.Name != "" {
		n := userData.Name
		name = &n
	}

	authProvider, err := reposqlc.AddUserAuthProviders(ctx, &sqlc_repository.AddUserAuthProvidersParams{
		UserID:      int64(userID),
		ProviderUid: userData.ProviderID,
		Provider:    userData.ProviderName,
		Name:        name,
	})
	if err != nil {
		return nil, err
	}

	result := &model.UserAuthProvider{
		UserID:     model.UserID(authProvider.UserID),
		ProviderUID: authProvider.ProviderUid,
		Provider:   authProvider.Provider,
	}
	if authProvider.Name != nil {
		result.Name = authProvider.Name
	}

	return result, nil
}

func (r *Repository) GetUserAuthProvidersByUserID(ctx context.Context, userID model.UserID) ([]*model.UserAuthProvider, error) {
	reposqlc := sqlc_repository.New(r.conn)
	authProviders, err := reposqlc.GetUserAuthProvidersByUserID(ctx, int64(userID))
	if err != nil {
		return nil, err
	}

	result := make([]*model.UserAuthProvider, len(authProviders))
	for i, ap := range authProviders {
		result[i] = &model.UserAuthProvider{
			UserID:     model.UserID(ap.UserID),
			ProviderUID: ap.ProviderUid,
			Provider:   ap.Provider,
		}
		if ap.Name != nil {
			result[i].Name = ap.Name
		}
	}

	return result, nil
}

func (r *Repository) GetUser(ctx context.Context, userID model.UserID) (*model.User, error) {
	reposqlc := sqlc_repository.New(r.conn)
	user, err := reposqlc.GetUserByID(ctx, int64(userID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	return &model.User{
		ID:        model.UserID(user.UserID),
		Name:      user.Name,
		CreatedAt: user.CreatedAt.Time,
	}, nil
}

func (r *Repository) UpdateUserName(ctx context.Context, userID model.UserID, name string) (*model.User, error) {
	reposqlc := sqlc_repository.New(r.conn)
	user, err := reposqlc.UpdateUserName(ctx, &sqlc_repository.UpdateUserNameParams{
		UserID: int64(userID),
		Name:   name,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	return &model.User{
		ID:        model.UserID(user.UserID),
		Name:      user.Name,
		CreatedAt: user.CreatedAt.Time,
	}, nil
}

func (r *Repository) SetUserAvatarIfEmpty(ctx context.Context, userID model.UserID, avatarURL *string) error {
	// This would require a migration to add avatar_url to users table
	// For now, we'll skip this functionality
	return nil
}
