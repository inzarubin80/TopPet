package service

import (
	"context"
	"errors"

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
		_ = s.hub.BroadcastContestMessage(contestID, map[string]interface{}{
			"type":                   "vote_counts_updated",
			"contest_id":             string(contestID),
			"participant_id":         string(participantID),
			"participant_total_votes": participantTotalVotes,
			"contest_total_votes":    contestTotalVotes,
		})
		if previousParticipantID != "" && previousParticipantID != participantID {
			previousTotalVotes, _ := s.repository.CountVotesByParticipant(ctx, previousParticipantID)
			_ = s.hub.BroadcastContestMessage(contestID, map[string]interface{}{
				"type":                   "vote_counts_updated",
				"contest_id":             string(contestID),
				"participant_id":         string(previousParticipantID),
				"participant_total_votes": previousTotalVotes,
				"contest_total_votes":    contestTotalVotes,
			})
		}
		_ = s.hub.SendContestMessageToUser(contestID, userID, map[string]interface{}{
			"type":          "user_vote_updated",
			"contest_id":    string(contestID),
			"participant_id": string(participantID),
		})
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
			_ = s.hub.BroadcastContestMessage(contestID, map[string]interface{}{
				"type":                   "vote_counts_updated",
				"contest_id":             string(contestID),
				"participant_id":         string(participantID),
				"participant_total_votes": participantTotalVotes,
				"contest_total_votes":    contestTotalVotes,
			})
		}
		_ = s.hub.SendContestMessageToUser(contestID, userID, map[string]interface{}{
			"type":          "user_vote_updated",
			"contest_id":    string(contestID),
			"participant_id": "",
		})
	}

	return participantID, nil
}
