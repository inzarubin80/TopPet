package service

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"toppet/server/internal/model"
	"toppet/server/internal/tier"
)

const (
	maxJuryBioShortLen     = 500
	maxJuryPortfolioURLLen = 2048
)

func (s *TopPetService) ListContestJury(ctx context.Context, contestID model.ContestID) ([]*model.JuryMember, error) {
	return s.repository.ListContestJuryMembers(ctx, contestID)
}

func (s *TopPetService) AddContestJuryMember(ctx context.Context, contestID model.ContestID, adminID model.UserID, memberUserID model.UserID) (*model.JuryMember, error) {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, adminID) {
		return nil, fmt.Errorf("%w: only contest admin can manage jury", model.ErrForbidden)
	}
	if !c.JuryVotingEnabled {
		return nil, fmt.Errorf("%w: jury voting is disabled for this contest", model.ErrBadRequest)
	}
	n, err := s.repository.CountContestJuryMembers(ctx, contestID)
	if err != nil {
		return nil, err
	}
	maxM := tier.MaxJuryMembersForTier(contestTierString(c))
	if int(n) >= maxM {
		return nil, fmt.Errorf("%w: maximum jury members for this tier is %d (upgrade to pro for a larger jury)", model.ErrBadRequest, maxM)
	}
	return s.repository.AddContestJuryMember(ctx, contestID, memberUserID)
}

// PatchContestJuryMember обновляет порядок, ссылку на портфолио и краткое описание члена жюри.
func (s *TopPetService) PatchContestJuryMember(ctx context.Context, contestID model.ContestID, adminID model.UserID, memberUserID model.UserID, patch model.JuryMemberPatch) (*model.JuryMember, error) {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, adminID) {
		return nil, model.ErrorForbidden
	}
	if !c.JuryVotingEnabled {
		return nil, fmt.Errorf("%w: jury voting is disabled for this contest", model.ErrBadRequest)
	}
	if patch.PortfolioURL == nil && patch.BioShort == nil && patch.SortOrder == nil {
		return nil, fmt.Errorf("%w: at least one of portfolio_url, bio_short, sort_order is required", model.ErrBadRequest)
	}
	cur, err := s.repository.GetContestJuryMember(ctx, contestID, memberUserID)
	if err != nil {
		return nil, err
	}
	portfolio := cur.PortfolioURL
	bio := cur.BioShort
	ord := cur.SortOrder
	if patch.PortfolioURL != nil {
		portfolio = strings.TrimSpace(*patch.PortfolioURL)
		if utf8.RuneCountInString(portfolio) > maxJuryPortfolioURLLen {
			return nil, fmt.Errorf("%w: portfolio_url is too long", model.ErrBadRequest)
		}
	}
	if patch.BioShort != nil {
		bio = strings.TrimSpace(*patch.BioShort)
		if utf8.RuneCountInString(bio) > maxJuryBioShortLen {
			return nil, fmt.Errorf("%w: bio_short is too long", model.ErrBadRequest)
		}
	}
	if patch.SortOrder != nil {
		if *patch.SortOrder < 0 {
			return nil, fmt.Errorf("%w: sort_order must be non-negative", model.ErrBadRequest)
		}
		ord = *patch.SortOrder
	}
	return s.repository.UpdateContestJuryMember(ctx, contestID, memberUserID, portfolio, bio, ord)
}

// ReorderContestJuryMembers задаёт порядок отображения жюри (полный список user_id в нужном порядке).
func (s *TopPetService) ReorderContestJuryMembers(ctx context.Context, contestID model.ContestID, adminID model.UserID, orderedUserIDs []model.UserID) error {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return err
	}
	if !s.userCanManageContest(ctx, c, adminID) {
		return model.ErrorForbidden
	}
	if !c.JuryVotingEnabled {
		return fmt.Errorf("%w: jury voting is disabled for this contest", model.ErrBadRequest)
	}
	if len(orderedUserIDs) == 0 {
		return fmt.Errorf("%w: user_ids is required", model.ErrBadRequest)
	}
	return s.repository.ReorderContestJuryMembers(ctx, contestID, orderedUserIDs)
}

func (s *TopPetService) RemoveContestJuryMember(ctx context.Context, contestID model.ContestID, adminID model.UserID, memberUserID model.UserID) error {
	c, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return err
	}
	if !s.userCanManageContest(ctx, c, adminID) {
		return fmt.Errorf("%w: only contest admin can manage jury", model.ErrForbidden)
	}
	if !c.JuryVotingEnabled {
		return fmt.Errorf("%w: jury voting is disabled for this contest", model.ErrBadRequest)
	}
	return s.repository.RemoveContestJuryMember(ctx, contestID, memberUserID)
}

func (s *TopPetService) SearchUsers(ctx context.Context, q string, limit int) ([]*model.UserSearchHit, error) {
	if len(q) < 2 {
		return []*model.UserSearchHit{}, nil
	}
	lim := int32(limit)
	if lim < 1 {
		lim = 20
	}
	return s.repository.SearchUsersByQuery(ctx, q, lim)
}
