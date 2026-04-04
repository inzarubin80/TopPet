package model

import "errors"

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrNotFound     = errors.New("not found")
	ErrBadRequest   = errors.New("bad request")

	ErrInvalidUserRole   = errors.New("invalid user role")
	ErrLastSystemAdmin   = errors.New("cannot demote the last system administrator")
)

