package service

import (
	"context"
	"fmt"
	"strings"

	"toppet/server/internal/model"
)

const maxMinPhotosPerNomination = 30

// minPhotosRequiredForContestParticipant — минимум фото для заявки: без номинаций у конкурса → 1; иначе из номинации (1…30).
func (s *TopPetService) minPhotosRequiredForContestParticipant(ctx context.Context, contestID model.ContestID, nominationID *string) (int32, error) {
	nCount, err := s.repository.CountNominationsByContest(ctx, contestID)
	if err != nil {
		return 0, err
	}
	if nCount == 0 {
		return 1, nil
	}
	if nominationID == nil || strings.TrimSpace(*nominationID) == "" {
		return 0, fmt.Errorf("%w: nomination_id is required when contest has nominations", model.ErrBadRequest)
	}
	nom, err := s.repository.GetNominationByContest(ctx, contestID, strings.TrimSpace(*nominationID))
	if err != nil {
		return 0, err
	}
	mp := int32(nom.MinPhotoCount)
	if mp < 1 {
		mp = 1
	}
	if mp > maxMinPhotosPerNomination {
		mp = maxMinPhotosPerNomination
	}
	return mp, nil
}

// ensureParticipantPhotoCountAtLeastMin проверяет число фото в БД относительно правил номинации/конкурса.
func (s *TopPetService) ensureParticipantPhotoCountAtLeastMin(ctx context.Context, p *model.Participant) error {
	minN, err := s.minPhotosRequiredForContestParticipant(ctx, p.ContestID, p.NominationID)
	if err != nil {
		return err
	}
	photos, err := s.repository.GetPhotosByParticipantID(ctx, p.ID)
	if err != nil {
		return err
	}
	if int32(len(photos)) < minN {
		return fmt.Errorf("%w: need at least %d photos for this application (have %d)", model.ErrBadRequest, minN, len(photos))
	}
	return nil
}
