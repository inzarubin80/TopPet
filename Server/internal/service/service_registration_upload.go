package service

import (
	"context"
	"fmt"
	"strings"

	"toppet/server/internal/model"
)

// EnsureRegistrationImageUploadAllowed — конкурс в черновике/регистрации; при непустом fieldID поле существует и тип image.
func (s *TopPetService) EnsureRegistrationImageUploadAllowed(ctx context.Context, contestID model.ContestID, fieldID string) error {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return err
	}
	if c.Status != model.ContestStatusDraft && c.Status != model.ContestStatusRegistration {
		return fmt.Errorf("%w: image upload for registration fields is only allowed in draft or registration", model.ErrBadRequest)
	}
	fid := strings.TrimSpace(fieldID)
	if fid == "" {
		return nil
	}
	fields, err := s.repository.ListRegistrationFieldsByContest(ctx, contestID)
	if err != nil {
		return err
	}
	for _, f := range fields {
		if f.ID == fid && f.FieldType == "image" {
			return nil
		}
	}
	return fmt.Errorf("%w: field is not an image field for this contest", model.ErrBadRequest)
}
