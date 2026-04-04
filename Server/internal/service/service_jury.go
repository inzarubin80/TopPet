package service

import (
	"context"
	"errors"
	"fmt"

	"toppet/server/internal/model"
	"toppet/server/internal/tier"
)

func (s *TopPetService) ListContestJury(ctx context.Context, contestID model.ContestID) ([]*model.JuryMember, error) {
	return s.repository.ListContestJuryMembers(ctx, contestID)
}

func (s *TopPetService) AddContestJuryMember(ctx context.Context, contestID model.ContestID, adminID model.UserID, memberUserID model.UserID) (*model.JuryMember, error) {
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, c, adminID) {
		return nil, errors.New("only contest admin can manage jury")
	}
	if c.Status != model.ContestStatusDraft {
		return nil, errors.New("jury can only be edited in draft status")
	}
	if !c.JuryVotingEnabled {
		return nil, errors.New("jury voting is disabled for this contest")
	}
	n, err := s.repository.CountContestJuryMembers(ctx, contestID)
	if err != nil {
		return nil, err
	}
	maxM := tier.MaxJuryMembersForTier(contestTierString(c))
	if int(n) >= maxM {
		return nil, fmt.Errorf("maximum jury members for this tier is %d", maxM)
	}
	return s.repository.AddContestJuryMember(ctx, contestID, memberUserID)
}

func (s *TopPetService) RemoveContestJuryMember(ctx context.Context, contestID model.ContestID, adminID model.UserID, memberUserID model.UserID) error {
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return err
	}
	if !s.userCanManageContest(ctx, c, adminID) {
		return errors.New("only contest admin can manage jury")
	}
	if c.Status != model.ContestStatusDraft {
		return errors.New("jury can only be edited in draft status")
	}
	if !c.JuryVotingEnabled {
		return errors.New("jury voting is disabled for this contest")
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
