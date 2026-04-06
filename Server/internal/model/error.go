package model

import "errors"

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrNotFound     = errors.New("not found")
	ErrBadRequest   = errors.New("bad request")

	ErrInvalidUserRole   = errors.New("invalid user role")
	ErrLastSystemAdmin   = errors.New("cannot demote the last system administrator")
	// ErrUserBlocked — аккаунт заблокирован (нельзя войти или обновить токен).
	ErrUserBlocked = errors.New("account is blocked")

	// ErrParticipantEmailDomainNotAllowed — заявка отклонена: e-mail не из разрешённых доменов конкурса.
	ErrParticipantEmailDomainNotAllowed = errors.New("participant email domain not allowed for this contest")

	// ErrAlreadyParticipatingInNomination — пользователь уже подал заявку в эту номинацию.
	ErrAlreadyParticipatingInNomination = errors.New("already participating in this nomination")
	// ErrAlreadyParticipatingInContest — пользователь уже подал заявку в конкурс без номинаций.
	ErrAlreadyParticipatingInContest = errors.New("already participating in this contest")
)

