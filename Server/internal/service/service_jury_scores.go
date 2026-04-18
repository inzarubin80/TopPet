package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"toppet/server/internal/model"
)

func validateJuryScoreValue(min, max, step int32, score int32) error {
	if score < min || score > max {
		return fmt.Errorf("score must be between %d and %d", min, max)
	}
	st := step
	if st < 1 {
		st = 1
	}
	if (score-min)%st != 0 {
		return errors.New("score must align with criterion scale step")
	}
	return nil
}

func juryScoresContestAllowsRead(c *model.Contest) bool {
	switch c.Status {
	case model.ContestStatusRegistration, model.ContestStatusVoting, model.ContestStatusFinished:
		return true
	default:
		return false
	}
}

func juryScoresContestAllowsWrite(c *model.Contest) bool {
	switch c.Status {
	case model.ContestStatusRegistration, model.ContestStatusVoting:
		return true
	default:
		return false
	}
}

// GetMyJuryScoresForParticipant возвращает оценки текущего жюри по заявке (по всем критериям, где уже выставлены).
func (s *TopPetService) GetMyJuryScoresForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, jurorID model.UserID) ([]*model.JuryScore, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !contest.JuryVotingEnabled {
		return nil, model.ErrorForbidden
	}
	if !juryScoresContestAllowsRead(contest) {
		return nil, model.ErrorForbidden
	}
	ok, err := s.repository.IsContestJuryMember(ctx, contestID, jurorID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, model.ErrorForbidden
	}
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}
	if participant.ContestID != contestID {
		return nil, fmt.Errorf("%w", model.ErrorNotFound)
	}
	jurorPtr := &jurorID
	if !s.participantVisible(ctx, participant, contest, jurorPtr) {
		return nil, fmt.Errorf("%w", model.ErrorNotFound)
	}
	return s.repository.ListContestJuryScoresByParticipantAndUser(ctx, participantID, jurorID)
}

// GetJuryScoresReportForParticipant — детальные оценки жюри по заявке (организатор конкурса или председатель жюри).
func (s *TopPetService) GetJuryScoresReportForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, actorID model.UserID) ([]*model.JuryScoreReportItem, float64, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, 0, err
	}
	if !contest.JuryVotingEnabled {
		return nil, 0, model.ErrorForbidden
	}
	if !s.userCanManageContest(ctx, contest, actorID) && !s.canAccessJuryChair(ctx, contest, actorID) {
		return nil, 0, model.ErrorForbidden
	}
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, 0, err
	}
	if participant.ContestID != contestID {
		return nil, 0, fmt.Errorf("%w", model.ErrorNotFound)
	}
	items, err := s.repository.ListContestJuryScoresReportByParticipant(ctx, participantID)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repository.SumJuryScoresByParticipantID(ctx, participantID)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetJuryVotingProgressReportForContest — матрица «работа × жюри»: сколько критериев выставлено (организаторы конкурса).
func (s *TopPetService) GetJuryVotingProgressReportForContest(ctx context.Context, contestID model.ContestID, actorID model.UserID) ([]*model.JuryVotingProgressRow, int64, int64, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, 0, 0, err
	}
	if !contest.JuryVotingEnabled {
		return nil, 0, 0, model.ErrorForbidden
	}
	if !s.userCanManageContest(ctx, contest, actorID) {
		return nil, 0, 0, model.ErrorForbidden
	}
	rows, err := s.repository.ListContestJuryVotingProgressByContest(ctx, contestID)
	if err != nil {
		return nil, 0, 0, err
	}
	criteriaTotal, cErr := s.repository.CountContestJuryCriteria(ctx, contestID)
	if cErr != nil {
		return nil, 0, 0, cErr
	}
	juryMembers, jErr := s.repository.CountContestJuryMembers(ctx, contestID)
	if jErr != nil {
		return nil, 0, 0, jErr
	}
	return rows, criteriaTotal, juryMembers, nil
}

// PutMyJuryScoresForParticipant сохраняет оценки жюри по критериям для заявки.
func (s *TopPetService) PutMyJuryScoresForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, jurorID model.UserID, items []model.JuryScorePutItem) ([]*model.JuryScore, error) {
	if len(items) == 0 {
		return nil, fmt.Errorf("%w: items required", model.ErrBadRequest)
	}
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !contest.JuryVotingEnabled {
		return nil, model.ErrorForbidden
	}
	if !juryScoresContestAllowsWrite(contest) {
		return nil, fmt.Errorf("%w: jury scores can only be set during registration or voting", model.ErrBadRequest)
	}
	ok, err := s.repository.IsContestJuryMember(ctx, contestID, jurorID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, model.ErrorForbidden
	}
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}
	if participant.ContestID != contestID {
		return nil, fmt.Errorf("%w", model.ErrorNotFound)
	}
	jurorPtr := &jurorID
	if !s.participantVisible(ctx, participant, contest, jurorPtr) {
		return nil, fmt.Errorf("%w", model.ErrorNotFound)
	}
	criteria, err := s.repository.ListJuryCriteriaByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if len(criteria) == 0 {
		return nil, fmt.Errorf("%w: contest has no jury criteria", model.ErrBadRequest)
	}
	byID := make(map[string]*model.JuryCriterion, len(criteria))
	for _, c := range criteria {
		byID[c.ID] = c
	}
	seen := make(map[string]struct{}, len(items))
	for i := range items {
		it := items[i]
		cid := strings.TrimSpace(it.CriterionID)
		if cid == "" {
			return nil, fmt.Errorf("criterion_id is required at index %d", i)
		}
		if _, dup := seen[cid]; dup {
			return nil, fmt.Errorf("%w: duplicate criterion_id in request", model.ErrBadRequest)
		}
		seen[cid] = struct{}{}
		cr, ok := byID[cid]
		if !ok {
			return nil, fmt.Errorf("%w: criterion not in this contest", model.ErrBadRequest)
		}
		if err := validateJuryScoreValue(cr.ScaleMin, cr.ScaleMax, cr.ScaleStep, it.Score); err != nil {
			return nil, fmt.Errorf("%w: %s — %v", model.ErrBadRequest, cr.Title, err)
		}
		if _, err := s.repository.UpsertContestJuryScore(ctx, participantID, cid, jurorID, it.Score); err != nil {
			return nil, err
		}
	}
	return s.repository.ListContestJuryScoresByParticipantAndUser(ctx, participantID, jurorID)
}
