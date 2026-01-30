package service

import (
	"context"
	"errors"

	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

func (s *TopPetService) Vote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error) {
	// Check contest exists and is in voting status
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if contest.Status != model.ContestStatusVoting {
		return nil, errors.New("voting is only allowed during voting stage")
	}

	// Check participant exists and belongs to contest
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	if participant.ContestID != contestID {
		return nil, errors.New("participant does not belong to this contest")
	}

	var previousParticipantID model.ParticipantID
	if existingVote, err := s.repository.GetContestVoteByUser(ctx, contestID, userID); err == nil {
		previousParticipantID = existingVote.ParticipantID
	}

	// Upsert vote (last vote wins)
	vote, err := s.repository.UpsertContestVote(ctx, contestID, participantID, userID)
	if err != nil {
		return nil, err
	}

	if s.hub != nil {
		contestTotalVotes, _ := s.repository.CountVotesByContest(ctx, contestID)
		participantTotalVotes, _ := s.repository.CountVotesByParticipant(ctx, participantID)
		payload := wsapp.VoteCountsUpdatedPayload{
			Type:                wsapp.MessageTypeVoteCreated,
			ContestID:           contestID,
			ParticipantID:       participantID,
			ParticipantTotalVotes: participantTotalVotes,
			ContestTotalVotes:   contestTotalVotes,
		}
		_ = s.hub.BroadcastContestMessage(contestID, payload)
		if previousParticipantID != "" && previousParticipantID != participantID {
			previousTotalVotes, _ := s.repository.CountVotesByParticipant(ctx, previousParticipantID)
			prevPayload := wsapp.VoteCountsUpdatedPayload{
				Type:                wsapp.MessageTypeVoteCreated,
				ContestID:           contestID,
				ParticipantID:       previousParticipantID,
				ParticipantTotalVotes: previousTotalVotes,
				ContestTotalVotes:   contestTotalVotes,
			}
			_ = s.hub.BroadcastContestMessage(contestID, prevPayload)
		}
		userPayload := wsapp.UserVoteUpdatedPayload{
			Type:          wsapp.MessageTypeVoteCreated,
			ContestID:     contestID,
			ParticipantID: participantID,
		}
		_ = s.hub.SendContestMessageToUser(contestID, userID, userPayload)
	}

	return vote, nil
}

func (s *TopPetService) GetUserVote(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Vote, error) {
	vote, err := s.repository.GetContestVoteByUser(ctx, contestID, userID)
	if err != nil {
		return nil, err
	}
	return vote, nil
}

func (s *TopPetService) Unvote(ctx context.Context, contestID model.ContestID, userID model.UserID) (model.ParticipantID, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return "", err
	}

	if contest.Status != model.ContestStatusVoting {
		return "", errors.New("voting is only allowed during voting stage")
	}

	participantID, err := s.repository.DeleteContestVoteByUser(ctx, contestID, userID)
	if err != nil {
		return "", err
	}

	if s.hub != nil {
		contestTotalVotes, _ := s.repository.CountVotesByContest(ctx, contestID)
		if participantID != "" {
			participantTotalVotes, _ := s.repository.CountVotesByParticipant(ctx, participantID)
			payload := wsapp.VoteCountsUpdatedPayload{
				Type:                wsapp.MessageTypeVoteDeleted,
				ContestID:           contestID,
				ParticipantID:       participantID,
				ParticipantTotalVotes: participantTotalVotes,
				ContestTotalVotes:   contestTotalVotes,
			}
			_ = s.hub.BroadcastContestMessage(contestID, payload)
		}
		userPayload := wsapp.UserVoteUpdatedPayload{
			Type:          wsapp.MessageTypeVoteDeleted,
			ContestID:     contestID,
			ParticipantID: "",
		}
		_ = s.hub.SendContestMessageToUser(contestID, userID, userPayload)
	}

	return participantID, nil
}

func (s *TopPetService) ListVotersForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) ([]*model.VoterInfo, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if contest.CreatedByUserID != userID {
		return nil, model.ErrorForbidden
	}
	return s.repository.ListVotersByParticipant(ctx, contestID, participantID)
}
