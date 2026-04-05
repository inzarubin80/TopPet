package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

var oauthEmailFormat = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func normalizeOAuthEmail(s string) string {
	s = strings.TrimSpace(s)
	if s == "" || !oauthEmailFormat.MatchString(s) {
		return ""
	}
	return s
}

func (r *Repository) CreateUser(ctx context.Context, name string) (*model.User, error) {
	reposqlc := sqlc_repository.New(r.conn)
	user, err := reposqlc.CreateUser(ctx, &sqlc_repository.CreateUserParams{Name: name, Email: ""})
	if err != nil {
		return nil, err
	}

	return sqlcUserToModel(user), nil
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

	email := normalizeOAuthEmail(userData.Email)
	user, err := reposqlc.CreateUser(ctx, &sqlc_repository.CreateUserParams{Name: name, Email: email})
	if err != nil && isUniqueViolation(err) && email != "" {
		user, err = reposqlc.CreateUser(ctx, &sqlc_repository.CreateUserParams{Name: name, Email: ""})
	}
	if err != nil {
		return nil, err
	}

	return sqlcUserToModel(user), nil
}

func (r *Repository) SetUserEmailIfEmpty(ctx context.Context, userID model.UserID, email string) error {
	email = normalizeOAuthEmail(email)
	if email == "" {
		return nil
	}
	reposqlc := sqlc_repository.New(r.conn)
	e := email
	return reposqlc.SetUserEmailIfEmpty(ctx, &sqlc_repository.SetUserEmailIfEmptyParams{
		UserID: int64(userID),
		Email:  &e,
	})
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

	return sqlcUserToModel(user), nil
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

	return sqlcUserToModel(user), nil
}

func (r *Repository) GetUserRole(ctx context.Context, userID model.UserID) (string, error) {
	reposqlc := sqlc_repository.New(r.conn)
	role, err := reposqlc.GetUserRole(ctx, int64(userID))
	if err != nil {
		return "", err
	}
	if role == "" {
		return model.UserRoleUser, nil
	}
	return role, nil
}

func authProvidersListFromSQL(v interface{}) []string {
	if v == nil {
		return nil
	}
	var s string
	switch x := v.(type) {
	case string:
		s = strings.TrimSpace(x)
	case []byte:
		s = strings.TrimSpace(string(x))
	default:
		s = strings.TrimSpace(fmt.Sprint(x))
	}
	if s == "" {
		return nil
	}
	return strings.Split(s, ", ")
}

func (r *Repository) ListUsersForAdmin(ctx context.Context, limit, offset int32) ([]*model.User, error) {
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListUsersForAdmin(ctx, &sqlc_repository.ListUsersForAdminParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, err
	}
	out := make([]*model.User, 0, len(rows))
	for _, row := range rows {
		u := &sqlc_repository.User{
			UserID:    row.UserID,
			Name:      row.Name,
			CreatedAt: row.CreatedAt,
			Email:     row.Email,
			Role:      row.Role,
		}
		mu := sqlcUserToModel(u)
		mu.AuthProviders = authProvidersListFromSQL(row.AuthProviders)
		out = append(out, mu)
	}
	return out, nil
}

func (r *Repository) CountUsers(ctx context.Context) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	return reposqlc.CountUsers(ctx)
}

func (r *Repository) CountSystemAdmins(ctx context.Context) (int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	return reposqlc.CountSystemAdmins(ctx)
}

func (r *Repository) UpdateUserRole(ctx context.Context, userID model.UserID, role string) (*model.User, error) {
	reposqlc := sqlc_repository.New(r.conn)
	user, err := reposqlc.UpdateUserRole(ctx, &sqlc_repository.UpdateUserRoleParams{
		UserID: int64(userID),
		Role:   role,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}
	return sqlcUserToModel(user), nil
}

func (r *Repository) SetUserAvatarIfEmpty(ctx context.Context, userID model.UserID, avatarURL *string) error {
	// This would require a migration to add avatar_url to users table
	// For now, we'll skip this functionality
	return nil
}
