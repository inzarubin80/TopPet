package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"toppet/server/internal/model"
	"toppet/server/internal/tier"
)

func contestTierString(c *model.Contest) string {
	if c.Tier != "" {
		return c.Tier
	}
	return tier.TierFree
}

func normalizeJuryCriterionInput(in *model.JuryCriterionInput) {
	if in == nil {
		return
	}
	if in.ScaleMin == 0 && in.ScaleMax == 0 {
		in.ScaleMin = 1
		in.ScaleMax = 10
	}
	if in.ScaleStep == 0 {
		in.ScaleStep = 1
	}
}

func validateJuryCriterionInput(i int, in *model.JuryCriterionInput) error {
	if strings.TrimSpace(in.Title) == "" {
		return fmt.Errorf("criterion %d: title is required", i+1)
	}
	if in.ScaleMin >= in.ScaleMax {
		return fmt.Errorf("criterion %d: scale_min must be less than scale_max", i+1)
	}
	if in.ScaleStep < 1 {
		return fmt.Errorf("criterion %d: scale_step must be at least 1", i+1)
	}
	if in.ScaleMax-in.ScaleMin > 10000 {
		return fmt.Errorf("criterion %d: scale range too large", i+1)
	}
	return nil
}

func (s *TopPetService) ListContestJuryCriteria(ctx context.Context, contestID model.ContestID) ([]*model.JuryCriterion, error) {
	return s.repository.ListJuryCriteriaByContest(ctx, contestID)
}

func (s *TopPetService) ReplaceContestJuryCriteria(ctx context.Context, contestID model.ContestID, adminID model.UserID, items []*model.JuryCriterionInput) ([]*model.JuryCriterion, error) {
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if c.CreatedByUserID != adminID {
		return nil, errors.New("only contest admin can edit jury criteria")
	}
	if c.Status != model.ContestStatusDraft {
		return nil, errors.New("jury criteria can only be edited in draft status")
	}
	maxC := tier.MaxJuryCriteriaForTier(contestTierString(c))
	if len(items) > maxC {
		return nil, fmt.Errorf("maximum jury criteria for this tier is %d", maxC)
	}
	for i := range items {
		normalizeJuryCriterionInput(items[i])
		if err := validateJuryCriterionInput(i, items[i]); err != nil {
			return nil, err
		}
	}
	if err := s.repository.ReplaceContestJuryCriteria(ctx, contestID, items); err != nil {
		return nil, err
	}
	return s.repository.ListJuryCriteriaByContest(ctx, contestID)
}

func (s *TopPetService) CreateNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, title, description string) (*model.Nomination, error) {
	if strings.TrimSpace(title) == "" {
		return nil, errors.New("title is required")
	}
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if c.CreatedByUserID != userID {
		return nil, errors.New("only contest admin can add nominations")
	}
	if c.Status != model.ContestStatusDraft {
		return nil, errors.New("nominations can only be edited in draft status")
	}
	n, err := s.repository.CountNominationsByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	maxN := tier.MaxNominationsForTier(contestTierString(c))
	if int(n) >= maxN {
		return nil, fmt.Errorf("maximum nominations for this tier is %d", maxN)
	}
	return s.repository.CreateNomination(ctx, contestID, strings.TrimSpace(title), strings.TrimSpace(description), int(n))
}

func (s *TopPetService) ListNominations(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error) {
	return s.repository.ListNominationsByContest(ctx, contestID)
}

func (s *TopPetService) UpdateNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID string, title, description string) (*model.Nomination, error) {
	if strings.TrimSpace(title) == "" {
		return nil, errors.New("title is required")
	}
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if c.CreatedByUserID != userID {
		return nil, errors.New("only contest admin can edit nominations")
	}
	if c.Status != model.ContestStatusDraft {
		return nil, errors.New("nominations can only be edited in draft status")
	}
	return s.repository.UpdateNomination(ctx, contestID, nominationID, strings.TrimSpace(title), strings.TrimSpace(description))
}

func (s *TopPetService) DeleteNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID string) error {
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return err
	}
	if c.CreatedByUserID != userID {
		return errors.New("only contest admin can delete nominations")
	}
	if c.Status != model.ContestStatusDraft {
		return errors.New("nominations can only be deleted in draft status")
	}
	return s.repository.DeleteNomination(ctx, nominationID)
}

func (s *TopPetService) ListContestRegistrationFields(ctx context.Context, contestID model.ContestID) ([]*model.RegistrationField, error) {
	return s.repository.ListRegistrationFieldsByContest(ctx, contestID)
}

func (s *TopPetService) ReplaceContestRegistrationFields(ctx context.Context, contestID model.ContestID, adminID model.UserID, items []*model.RegistrationFieldInput) ([]*model.RegistrationField, error) {
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if c.CreatedByUserID != adminID {
		return nil, errors.New("only contest admin can edit registration fields")
	}
	if c.Status != model.ContestStatusDraft {
		return nil, errors.New("registration fields can only be edited in draft status")
	}
	for i := range items {
		items[i].Label = strings.TrimSpace(items[i].Label)
		if items[i].Label == "" {
			return nil, fmt.Errorf("field %d: label is required", i+1)
		}
		ft := items[i].FieldType
		if ft != "string" && ft != "number" && ft != "boolean" && ft != "enum" {
			return nil, fmt.Errorf("field %d: invalid field_type", i+1)
		}
		if ft == "enum" && len(items[i].EnumOptions) < 1 {
			return nil, fmt.Errorf("field %d: enum requires enum_options", i+1)
		}
	}
	if err := s.repository.ReplaceContestRegistrationFields(ctx, contestID, items); err != nil {
		return nil, err
	}
	return s.repository.ListRegistrationFieldsByContest(ctx, contestID)
}
