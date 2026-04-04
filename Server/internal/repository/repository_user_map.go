package repository

import (
	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func sqlcUserToModel(u *sqlc_repository.User) *model.User {
	if u == nil {
		return nil
	}
	out := &model.User{
		ID:        model.UserID(u.UserID),
		Name:      u.Name,
		CreatedAt: u.CreatedAt.Time,
		Role:      u.Role,
	}
	if u.Role == "" {
		out.Role = model.UserRoleUser
	}
	if u.Email != nil {
		out.Email = *u.Email
	}
	return out
}
