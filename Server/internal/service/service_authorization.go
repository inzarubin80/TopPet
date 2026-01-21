package service

import (
	"context"

	"toppet/server/internal/model"
)

func (s *TopPetService) Authorization(ctx context.Context, accessToken string) (*model.Claims, error) {
	return s.accessTokenService.ValidateToken(accessToken)
}
