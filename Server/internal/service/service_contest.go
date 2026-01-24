package service

import (
	"context"
	"errors"
	"fmt"

	"toppet/server/internal/model"
)

func (s *TopPetService) CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
	if title == "" {
		return nil, errors.New("title is required")
	}

	contest, err := s.repository.CreateContest(ctx, userID, title, description)
	if err != nil {
		return nil, err
	}

	return contest, nil
}

func (s *TopPetService) GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	// Add total votes count
	totalVotes, err := s.repository.CountVotesByContest(ctx, contestID)
	if err == nil {
		contest.TotalVotes = totalVotes
	}

	return contest, nil
}

func (s *TopPetService) ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	contests, total, err := s.repository.ListContests(ctx, status, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	// Add total votes for each contest
	for _, contest := range contests {
		totalVotes, err := s.repository.CountVotesByContest(ctx, contest.ID)
		if err == nil {
			contest.TotalVotes = totalVotes
		}
	}

	return contests, total, nil
}

func (s *TopPetService) UpdateContest(ctx context.Context, contestID model.ContestID, userID model.UserID, title, description string) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	// Only admin can update
	if contest.CreatedByUserID != userID {
		return nil, errors.New("only contest admin can update contest")
	}

	// Only draft can be updated
	if contest.Status != model.ContestStatusDraft {
		return nil, fmt.Errorf("contest must be in draft status to update, current status: %s", contest.Status)
	}

	return s.repository.UpdateContest(ctx, contestID, title, description)
}

func (s *TopPetService) PublishContest(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	// Only admin can publish
	if contest.CreatedByUserID != userID {
		return nil, errors.New("only contest admin can publish contest")
	}

	// Only draft can be opened for registration
	if contest.Status != model.ContestStatusDraft {
		return nil, fmt.Errorf("contest must be in draft status to publish, current status: %s", contest.Status)
	}

	return s.repository.UpdateContestStatus(ctx, contestID, model.ContestStatusRegistration)
}

func (s *TopPetService) FinishContest(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	// Only admin can finish
	if contest.CreatedByUserID != userID {
		return nil, errors.New("only contest admin can finish contest")
	}

	// Only voting can be finished
	if contest.Status != model.ContestStatusVoting {
		return nil, fmt.Errorf("contest must be in voting status to finish, current status: %s", contest.Status)
	}

	return s.repository.UpdateContestStatus(ctx, contestID, model.ContestStatusFinished)
}

func (s *TopPetService) UpdateContestStatus(ctx context.Context, contestID model.ContestID, userID model.UserID, status model.ContestStatus) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if contest.CreatedByUserID != userID {
		return nil, errors.New("only contest admin can update contest status")
	}

	switch status {
	case model.ContestStatusDraft,
		model.ContestStatusRegistration,
		model.ContestStatusVoting,
		model.ContestStatusFinished:
	default:
		return nil, fmt.Errorf("invalid contest status %s", status)
	}

	updated, err := s.repository.UpdateContestStatus(ctx, contestID, status)
	if err != nil {
		return nil, err
	}

	if s.hub != nil {
		_ = s.hub.BroadcastContestMessage(contestID, map[string]interface{}{
			"type":       "contest_status_updated",
			"contest_id": string(contestID),
			"status":     status,
		})
	}

	return updated, nil
}

func (s *TopPetService) DeleteContest(ctx context.Context, contestID model.ContestID, userID model.UserID) error {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return err
	}

	// Only admin can delete
	if contest.CreatedByUserID != userID {
		return errors.New("only contest admin can delete contest")
	}

	return s.repository.DeleteContest(ctx, contestID)
}
