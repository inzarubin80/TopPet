package service

import (
	"context"

	"toppet/server/internal/model"
)

// shouldExposeJuryScoreTotal — когда отдавать клиенту сумму баллов жюри по заявке.
func (s *TopPetService) shouldExposeJuryScoreTotal(ctx context.Context, contest *model.Contest, viewer *model.UserID) bool {
	if contest == nil || !contest.JuryVotingEnabled {
		return false
	}
	switch contest.Status {
	case model.ContestStatusVoting, model.ContestStatusFinished:
		return true
	case model.ContestStatusDraft, model.ContestStatusRegistration:
		if viewer == nil {
			return false
		}
		if s.userCanManageContest(ctx, contest, *viewer) {
			return true
		}
		ok, err := s.repository.IsContestJuryMember(ctx, contest.ID, *viewer)
		return err == nil && ok
	default:
		return false
	}
}

func (s *TopPetService) attachParticipantJuryScoreTotals(ctx context.Context, contest *model.Contest, viewer *model.UserID, participants []*model.Participant) {
	if len(participants) == 0 || !s.shouldExposeJuryScoreTotal(ctx, contest, viewer) {
		return
	}
	ids := make([]model.ParticipantID, len(participants))
	for i, p := range participants {
		ids[i] = p.ID
	}
	sums, err := s.repository.SumJuryScoresByParticipantIDs(ctx, ids)
	if err != nil {
		return
	}
	for _, p := range participants {
		v := sums[p.ID]
		p.TotalJuryScore = new(int64)
		*p.TotalJuryScore = v
	}
}

func (s *TopPetService) attachOneParticipantJuryScoreTotal(ctx context.Context, contest *model.Contest, viewer *model.UserID, participant *model.Participant) {
	if participant == nil || !s.shouldExposeJuryScoreTotal(ctx, contest, viewer) {
		return
	}
	sum, err := s.repository.SumJuryScoresByParticipantID(ctx, participant.ID)
	if err != nil {
		return
	}
	participant.TotalJuryScore = new(int64)
	*participant.TotalJuryScore = sum
}
