package service

import (
	"context"
	"errors"

	"toppet/server/internal/model"
)

func (s *TopPetService) Vote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error) {
	// Check contest exists and is published
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if contest.Status != model.ContestStatusPublished {
		return nil, errors.New("voting is only allowed for published contests")
	}

	// Check participant exists and belongs to contest
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	if participant.ContestID != contestID {
		return nil, errors.New("participant does not belong to this contest")
	}

	// Upsert vote (last vote wins)
	return s.repository.UpsertContestVote(ctx, contestID, participantID, userID)
}

func (s *TopPetService) GetUserVote(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Vote, error) {
	vote, err := s.repository.GetContestVoteByUser(ctx, contestID, userID)
	if err != nil {
		return nil, err
	}
	return vote, nil
}
