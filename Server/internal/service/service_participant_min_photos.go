package service

import (
	"context"
	"fmt"
	"strings"

	"toppet/server/internal/model"
)

const maxMinPhotosPerNomination = 30

// photoCountBoundsForContestParticipant — допустимый диапазон числа фото из настроек конкурса (min/max 1…30, max ≥ min).
// Если у конкурса есть номинации, nomination_id обязателен (категория заявки), но лимиты фото задаются на уровне конкурса.
func (s *TopPetService) photoCountBoundsForContestParticipant(ctx context.Context, contestID model.ContestID, nominationID *string) (minN, maxN int32, err error) {
	nCount, err := s.repository.CountNominationsByContest(ctx, contestID)
	if err != nil {
		return 0, 0, err
	}
	if nCount > 0 && (nominationID == nil || strings.TrimSpace(*nominationID) == "") {
		return 0, 0, fmt.Errorf("%w: nomination_id is required when contest has nominations", model.ErrBadRequest)
	}
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return 0, 0, err
	}
	mp := int32(c.MinPhotoCount)
	if mp < 1 {
		mp = 1
	}
	if mp > maxMinPhotosPerNomination {
		mp = maxMinPhotosPerNomination
	}
	mx := int32(c.MaxPhotoCount)
	if mx < 1 {
		mx = 1
	}
	if mx > maxMinPhotosPerNomination {
		mx = maxMinPhotosPerNomination
	}
	if mx < mp {
		mx = mp
	}
	return mp, mx, nil
}

// ensureParticipantPhotoCountInBounds проверяет число фото в БД относительно min/max конкурса.
func (s *TopPetService) ensureParticipantPhotoCountInBounds(ctx context.Context, p *model.Participant) error {
	minN, maxN, err := s.photoCountBoundsForContestParticipant(ctx, p.ContestID, p.NominationID)
	if err != nil {
		return err
	}
	photos, err := s.repository.GetPhotosByParticipantID(ctx, p.ID)
	if err != nil {
		return err
	}
	n := int32(len(photos))
	if n < minN {
		return fmt.Errorf("%w: need at least %d photos for this application (have %d)", model.ErrBadRequest, minN, n)
	}
	if n > maxN {
		return fmt.Errorf("%w: at most %d photos allowed for this application (have %d)", model.ErrBadRequest, maxN, n)
	}
	return nil
}
