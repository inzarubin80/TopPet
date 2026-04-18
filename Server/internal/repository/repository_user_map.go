package repository

import (
	"strings"
	"time"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"

	"github.com/jackc/pgx/v5/pgtype"
)

func userRowToModel(
	userID int64,
	name string,
	createdAt pgtype.Timestamptz,
	email *string,
	role string,
	isBlocked bool,
	dateOfBirth pgtype.Date,
	phone *string,
	avatarURL *string,
) *model.User {
	out := &model.User{
		ID:        model.UserID(userID),
		Name:      name,
		CreatedAt: createdAt.Time,
		Role:      role,
		IsBlocked: isBlocked,
	}
	if role == "" {
		out.Role = model.UserRoleUser
	}
	if email != nil {
		out.Email = *email
	}
	if dateOfBirth.Valid {
		d := dateOfBirth.Time
		d = time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
		out.DateOfBirth = &d
	}
	if phone != nil {
		out.Phone = strings.TrimSpace(*phone)
	}
	if avatarURL != nil {
		out.AvatarURL = strings.TrimSpace(*avatarURL)
	}
	return out
}

// optionalUserAvatarURL maps a nullable DB column to a trimmed string for JSON omitempty.
func optionalUserAvatarURL(p *string) string {
	if p == nil {
		return ""
	}
	return strings.TrimSpace(*p)
}

func userAvatarURLFromUser(u *model.User) string {
	if u == nil {
		return ""
	}
	return strings.TrimSpace(u.AvatarURL)
}

func sqlcUserToModelFromCreateUserRow(u *sqlc_repository.CreateUserRow) *model.User {
	if u == nil {
		return nil
	}
	return userRowToModel(u.UserID, u.Name, u.CreatedAt, u.Email, u.Role, u.IsBlocked, u.DateOfBirth, u.Phone, u.AvatarUrl)
}

func sqlcUserToModelFromGetUserByIDRow(u *sqlc_repository.GetUserByIDRow) *model.User {
	if u == nil {
		return nil
	}
	return userRowToModel(u.UserID, u.Name, u.CreatedAt, u.Email, u.Role, u.IsBlocked, u.DateOfBirth, u.Phone, u.AvatarUrl)
}

func sqlcUserToModelFromUpdateUserNameRow(u *sqlc_repository.UpdateUserNameRow) *model.User {
	if u == nil {
		return nil
	}
	return userRowToModel(u.UserID, u.Name, u.CreatedAt, u.Email, u.Role, u.IsBlocked, u.DateOfBirth, u.Phone, u.AvatarUrl)
}

func sqlcUserToModelFromUpdateUserBlockedRow(u *sqlc_repository.UpdateUserBlockedRow) *model.User {
	if u == nil {
		return nil
	}
	return userRowToModel(u.UserID, u.Name, u.CreatedAt, u.Email, u.Role, u.IsBlocked, u.DateOfBirth, u.Phone, u.AvatarUrl)
}

func sqlcUserToModelFromUpdateUserRoleRow(u *sqlc_repository.UpdateUserRoleRow) *model.User {
	if u == nil {
		return nil
	}
	return userRowToModel(u.UserID, u.Name, u.CreatedAt, u.Email, u.Role, u.IsBlocked, u.DateOfBirth, u.Phone, u.AvatarUrl)
}

func sqlcUserToModelFromUpdateUserProfileRow(u *sqlc_repository.UpdateUserProfileRow) *model.User {
	if u == nil {
		return nil
	}
	return userRowToModel(u.UserID, u.Name, u.CreatedAt, u.Email, u.Role, u.IsBlocked, u.DateOfBirth, u.Phone, u.AvatarUrl)
}
