package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

func voteNominationSlotFromParticipant(participant *model.Participant) *string {
	if participant == nil || participant.NominationID == nil {
		return nil
	}
	s := strings.TrimSpace(*participant.NominationID)
	if s == "" {
		return nil
	}
	return &s
}

// publicVoteAllowedForContestPhase — лайки (contest_votes) на этапах приёма заявок и голосования.
// Призовые места зрителей по числу лайков считаются только при contest.PublicVotingEnabled (см. computeContestWinnerOutcome).
func publicVoteAllowedForContestPhase(st model.ContestStatus) bool {
	return st == model.ContestStatusRegistration || st == model.ContestStatusVoting
}

func (s *TopPetService) Vote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !publicVoteAllowedForContestPhase(contest.Status) {
		return nil, fmt.Errorf("%w: public voting is only available during registration or voting phase", model.ErrBadRequest)
	}

	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	if participant.ContestID != contestID {
		return nil, errors.New("participant does not belong to this contest")
	}
	st := participant.SubmissionStatus
	if st == "" {
		st = model.ParticipantSubmissionAccepted
	}
	if st != model.ParticipantSubmissionAccepted {
		return nil, errors.New("participant is not available for voting")
	}

	nomSlot := voteNominationSlotFromParticipant(participant)
	vote, err := s.repository.UpsertContestVote(ctx, contestID, participantID, userID, nomSlot)
	if err != nil {
		return nil, err
	}

	if s.hub != nil {
		contestTotalVotes, _ := s.repository.CountVotesByContest(ctx, contestID)
		participantTotalVotes, _ := s.repository.CountVotesByParticipant(ctx, participantID)
		payload := wsapp.VoteCountsUpdatedPayload{
			Type:                  wsapp.MessageTypeVoteCreated,
			ContestID:             contestID,
			ParticipantID:         participantID,
			ParticipantTotalVotes: participantTotalVotes,
			ContestTotalVotes:     contestTotalVotes,
		}
		_ = s.hub.BroadcastContestMessage(contestID, payload)
		userPayload := wsapp.UserVoteUpdatedPayload{
			Type:          wsapp.MessageTypeUserVoteUpdated,
			ContestID:     contestID,
			ParticipantID: participantID,
			NominationID:  nomSlot,
		}
		_ = s.hub.SendContestMessageToUser(contestID, userID, userPayload)
	}

	return vote, nil
}

func (s *TopPetService) ListUserVotesForContest(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error) {
	return s.repository.ListContestVotesByUser(ctx, contestID, userID)
}

func (s *TopPetService) Unvote(ctx context.Context, contestID model.ContestID, userID model.UserID, participantID model.ParticipantID) (model.ParticipantID, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return "", err
	}

	if !publicVoteAllowedForContestPhase(contest.Status) {
		return "", fmt.Errorf("%w: public voting is only available during registration or voting phase", model.ErrBadRequest)
	}

	participantID, err = s.repository.DeleteContestVoteByUserAndParticipant(ctx, contestID, userID, participantID)
	if err != nil {
		return "", err
	}

	if s.hub != nil {
		contestTotalVotes, _ := s.repository.CountVotesByContest(ctx, contestID)
		if participantID != "" {
			participantTotalVotes, _ := s.repository.CountVotesByParticipant(ctx, participantID)
			payload := wsapp.VoteCountsUpdatedPayload{
				Type:                  wsapp.MessageTypeVoteDeleted,
				ContestID:             contestID,
				ParticipantID:         participantID,
				ParticipantTotalVotes: participantTotalVotes,
				ContestTotalVotes:     contestTotalVotes,
			}
			_ = s.hub.BroadcastContestMessage(contestID, payload)
		}
		userPayload := wsapp.UserVoteUpdatedPayload{
			Type:          wsapp.MessageTypeUserVoteUpdated,
			ContestID:     contestID,
			ParticipantID: "",
			NominationID:  nil,
		}
		_ = s.hub.SendContestMessageToUser(contestID, userID, userPayload)
	}

	return participantID, nil
}

func (s *TopPetService) ListVotersForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) ([]*model.VoterInfo, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, model.ErrorForbidden
	}
	return s.repository.ListVotersByParticipant(ctx, contestID, participantID)
}
