package service

import (
	"context"

	"toppet/server/internal/model"
)

// shouldExposeJuryScoreTotal — когда отдавать клиенту сумму баллов жюри по заявке (total_jury_score и связанные поля).
// Создатель конкурса и глобальные роли contest_admin / system_admin (см. userCanManageContest) видят суммы на любой фазе.
// Остальные пользователи (включая неавторизованных) получают эти поля только при status=finished.
func (s *TopPetService) shouldExposeJuryScoreTotal(ctx context.Context, contest *model.Contest, viewer *model.UserID) bool {
	if contest == nil || !contest.JuryVotingEnabled {
		return false
	}
	if viewer != nil && s.userCanManageContest(ctx, contest, *viewer) {
		return true
	}
	return contest.Status == model.ContestStatusFinished
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
	memberCount, mErr := s.repository.CountContestJuryMembers(ctx, contest.ID)
	criteriaCount, cErr := s.repository.CountContestJuryCriteria(ctx, contest.ID)
	progressByID, pErr := s.repository.CountJuryFullyScoredJurorsByParticipantIDs(ctx, ids)
	showProgress := mErr == nil && cErr == nil && pErr == nil && memberCount > 0 && criteriaCount > 0
	for _, p := range participants {
		v := sums[p.ID]
		p.TotalJuryScore = new(float64)
		*p.TotalJuryScore = v
		if mErr == nil && memberCount > 0 {
			p.JuryMemberCount = new(int64)
			*p.JuryMemberCount = memberCount
		}
		if cErr == nil && criteriaCount > 0 {
			p.JuryCriteriaCount = new(int64)
			*p.JuryCriteriaCount = criteriaCount
		}
		if showProgress {
			n := int64(0)
			if progressByID != nil {
				n = progressByID[p.ID]
			}
			p.JuryFullyScoredJurors = new(int64)
			*p.JuryFullyScoredJurors = n
		}
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
	participant.TotalJuryScore = new(float64)
	*participant.TotalJuryScore = sum
	memberCount, mErr := s.repository.CountContestJuryMembers(ctx, contest.ID)
	criteriaCount, cErr := s.repository.CountContestJuryCriteria(ctx, contest.ID)
	progressByID, pErr := s.repository.CountJuryFullyScoredJurorsByParticipantIDs(ctx, []model.ParticipantID{participant.ID})
	showProgress := mErr == nil && cErr == nil && pErr == nil && memberCount > 0 && criteriaCount > 0
	if mErr == nil && memberCount > 0 {
		participant.JuryMemberCount = new(int64)
		*participant.JuryMemberCount = memberCount
	}
	if cErr == nil && criteriaCount > 0 {
		participant.JuryCriteriaCount = new(int64)
		*participant.JuryCriteriaCount = criteriaCount
	}
	if showProgress {
		n := int64(0)
		if progressByID != nil {
			n = progressByID[participant.ID]
		}
		participant.JuryFullyScoredJurors = new(int64)
		*participant.JuryFullyScoredJurors = n
	}
}
