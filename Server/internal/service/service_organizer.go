package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"toppet/server/internal/model"
	"toppet/server/internal/tier"
)

const maxRegistrationFieldHelpRunes = 2000

func contestTierString(c *model.Contest) string {
	if c.Tier != "" {
		return c.Tier
	}
	return tier.TierFree
}

func nominationPhotoCountBoundToInt32(v int) (int32, error) {
	if v < 1 {
		v = 1
	}
	const maxNominationPhotos = 30
	if v > maxNominationPhotos {
		return 0, fmt.Errorf("photo count must be between 1 and %d", maxNominationPhotos)
	}
	return int32(v), nil
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
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, adminID) {
		return nil, errors.New("only contest admin can edit jury criteria")
	}
	if !c.JuryVotingEnabled {
		return nil, errors.New("jury voting is disabled for this contest")
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

func (s *TopPetService) CreateNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, title, description string, minPhotoCount, maxPhotoCount int) (*model.Nomination, error) {
	if strings.TrimSpace(title) == "" {
		return nil, errors.New("title is required")
	}
	mp, err := nominationPhotoCountBoundToInt32(minPhotoCount)
	if err != nil {
		return nil, err
	}
	mx, err := nominationPhotoCountBoundToInt32(maxPhotoCount)
	if err != nil {
		return nil, err
	}
	if mp > mx {
		return nil, fmt.Errorf("%w: min_photo_count must be <= max_photo_count", model.ErrBadRequest)
	}
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, userID) {
		return nil, errors.New("only contest admin can add nominations")
	}
	n, err := s.repository.CountNominationsByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	maxN := tier.MaxNominationsForTier(contestTierString(c))
	if int(n) >= maxN {
		return nil, fmt.Errorf("maximum nominations for this tier is %d", maxN)
	}
	return s.repository.CreateNomination(ctx, contestID, strings.TrimSpace(title), strings.TrimSpace(description), int(n), mp, mx)
}

func (s *TopPetService) ListNominations(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error) {
	return s.repository.ListNominationsByContest(ctx, contestID)
}

func (s *TopPetService) UpdateNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID string, title, description string, minPhotoCount, maxPhotoCount int) (*model.Nomination, error) {
	if strings.TrimSpace(title) == "" {
		return nil, errors.New("title is required")
	}
	mp, err := nominationPhotoCountBoundToInt32(minPhotoCount)
	if err != nil {
		return nil, err
	}
	mx, err := nominationPhotoCountBoundToInt32(maxPhotoCount)
	if err != nil {
		return nil, err
	}
	if mp > mx {
		return nil, fmt.Errorf("%w: min_photo_count must be <= max_photo_count", model.ErrBadRequest)
	}
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, userID) {
		return nil, errors.New("only contest admin can edit nominations")
	}
	return s.repository.UpdateNomination(ctx, contestID, nominationID, strings.TrimSpace(title), strings.TrimSpace(description), mp, mx)
}

func (s *TopPetService) UpdateNominationLogoURL(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID string, logoURL string) (*model.Nomination, error) {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, userID) {
		return nil, errors.New("only contest admin can upload nomination logo")
	}
	if _, err := s.repository.GetNominationByContest(ctx, contestID, nominationID); err != nil {
		return nil, err
	}
	return s.repository.UpdateNominationLogoUrl(ctx, contestID, nominationID, strings.TrimSpace(logoURL))
}

func (s *TopPetService) DeleteNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID string) error {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return err
	}
	if !s.userCanManageContest(ctx, c, userID) {
		return errors.New("only contest admin can delete nominations")
	}
	return s.repository.DeleteNomination(ctx, nominationID)
}

func (s *TopPetService) ReorderNominations(ctx context.Context, contestID model.ContestID, userID model.UserID, orderedIDs []string) ([]*model.Nomination, error) {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, userID) {
		return nil, errors.New("only contest admin can reorder nominations")
	}
	current, err := s.repository.ListNominationsByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	normalized := make([]string, len(orderedIDs))
	for i, id := range orderedIDs {
		normalized[i] = strings.TrimSpace(id)
	}
	if len(normalized) != len(current) {
		return nil, fmt.Errorf("%w: nomination_ids must list every nomination exactly once", model.ErrBadRequest)
	}
	want := make(map[string]struct{}, len(current))
	for _, n := range current {
		want[n.ID] = struct{}{}
	}
	seen := make(map[string]struct{}, len(normalized))
	for _, id := range normalized {
		if id == "" {
			return nil, fmt.Errorf("%w: empty nomination id", model.ErrBadRequest)
		}
		if _, dup := seen[id]; dup {
			return nil, fmt.Errorf("%w: duplicate nomination id", model.ErrBadRequest)
		}
		seen[id] = struct{}{}
		if _, ok := want[id]; !ok {
			return nil, fmt.Errorf("%w: unknown nomination id", model.ErrBadRequest)
		}
	}
	if len(seen) != len(want) {
		return nil, fmt.Errorf("%w: nomination_ids must list every nomination exactly once", model.ErrBadRequest)
	}

	if err := s.repository.ReorderNominationsByContest(ctx, contestID, normalized); err != nil {
		return nil, err
	}
	return s.repository.ListNominationsByContest(ctx, contestID)
}

func (s *TopPetService) ListContestRegistrationFields(ctx context.Context, contestID model.ContestID) ([]*model.RegistrationField, error) {
	return s.repository.ListRegistrationFieldsByContest(ctx, contestID)
}

func (s *TopPetService) ReplaceContestRegistrationFields(ctx context.Context, contestID model.ContestID, adminID model.UserID, items []*model.RegistrationFieldInput) ([]*model.RegistrationField, error) {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, adminID) {
		return nil, errors.New("only contest admin can edit registration fields")
	}
	for i := range items {
		items[i].Label = strings.TrimSpace(items[i].Label)
		if items[i].Label == "" {
			return nil, fmt.Errorf("field %d: label is required", i+1)
		}
		items[i].HelpText = strings.TrimSpace(items[i].HelpText)
		if utf8.RuneCountInString(items[i].HelpText) > maxRegistrationFieldHelpRunes {
			return nil, fmt.Errorf("field %d: help_text too long (max %d characters)", i+1, maxRegistrationFieldHelpRunes)
		}
		ft := items[i].FieldType
		if ft != "string" && ft != "number" && ft != "boolean" && ft != "enum" && ft != "textarea" && ft != "image" {
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
