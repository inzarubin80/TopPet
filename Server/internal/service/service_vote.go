package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

func appendDebugVoteLog(hypothesisID string, location string, message string, data map[string]any) {
	// #region agent log
	f, err := os.OpenFile("/home/ser/TopPet/.cursor/debug-d469fa.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer func() { _ = f.Close() }()
	payload := map[string]any{
		"sessionId":    "d469fa",
		"runId":        "run_ws_sync",
		"hypothesisId": hypothesisID,
		"location":     location,
		"message":      message,
		"data":         data,
		"timestamp":    time.Now().UnixMilli(),
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return
	}
	_, _ = f.Write(append(b, '\n'))
	// #endregion
}

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

func contestUserVoteAllowedForContestPhase(st model.ContestStatus) bool {
	return st == model.ContestStatusVoting
}

func isContestUserVotingModeLikes(mode model.ContestUserVotingMode) bool {
	return mode == "" || mode == model.ContestUserVotingModeLikes
}

func (s *TopPetService) canUserVoteInParticipantsOnlyMode(ctx context.Context, contestID model.ContestID, userID model.UserID) (bool, error) {
	parts, _, err := s.repository.ListParticipantsByContest(
		ctx,
		contestID,
		&userID,
		false,
		nil,
		false,
		model.ParticipantListScopeMine,
		model.ParticipantListSubmissionAccepted,
		false,
		false,
		1,
		0,
		model.ParticipantListSortCreatedAt,
	)
	if err != nil {
		return false, err
	}
	return len(parts) > 0, nil
}

func (s *TopPetService) Vote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}

	mode := contest.UserVotingMode
	if isContestUserVotingModeLikes(mode) {
		if !publicVoteAllowedForContestPhase(contest.Status) {
			return nil, fmt.Errorf("%w: public voting is only available during registration or voting phase", model.ErrBadRequest)
		}
	} else {
		if !contestUserVoteAllowedForContestPhase(contest.Status) {
			return nil, fmt.Errorf("%w: user voting is only available during voting phase", model.ErrBadRequest)
		}
		if mode == model.ContestUserVotingModeParticipantsOnly {
			ok, err := s.canUserVoteInParticipantsOnlyMode(ctx, contestID, userID)
			if err != nil {
				return nil, err
			}
			if !ok {
				return nil, fmt.Errorf("%w: only accepted participants can vote in this contest", model.ErrForbidden)
			}
		}
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
	var previousParticipantInSlot model.ParticipantID
	if !isContestUserVotingModeLikes(mode) {
		existingVotes, listErr := s.repository.ListContestUserVotesByUser(ctx, contestID, userID)
		if listErr != nil {
			appendDebugVoteLog("H7", "service_vote:Vote", "Failed to list existing user votes before upsert", map[string]any{
				"contestId":    contestID,
				"userId":       userID,
				"participantId": participantID,
				"nominationId": nomSlot,
				"error":        listErr.Error(),
			})
		} else {
			voteSlots := make([]map[string]any, 0, len(existingVotes))
			for _, existingVote := range existingVotes {
				if existingVote == nil {
					continue
				}
				existingNom := ""
				if existingVote.NominationID != nil {
					existingNom = strings.TrimSpace(*existingVote.NominationID)
				}
				targetNom := ""
				if nomSlot != nil {
					targetNom = strings.TrimSpace(*nomSlot)
				}
				if existingNom == targetNom {
					previousParticipantInSlot = existingVote.ParticipantID
				}
				voteSlots = append(voteSlots, map[string]any{
					"participantId": existingVote.ParticipantID,
					"nominationId":  existingNom,
				})
			}
			appendDebugVoteLog("H7", "service_vote:Vote", "Existing slot vote before upsert", map[string]any{
				"contestId":                 contestID,
				"userId":                    userID,
				"participantId":             participantID,
				"nominationId":              nomSlot,
				"existingVotesCount":        len(existingVotes),
				"previousParticipantInSlot": previousParticipantInSlot,
				"existingVoteSlots":         voteSlots,
			})
		}
	}
	var vote *model.Vote
	if isContestUserVotingModeLikes(mode) {
		vote, err = s.repository.UpsertContestVote(ctx, contestID, participantID, userID, nomSlot)
	} else {
		vote, err = s.repository.UpsertContestUserVote(ctx, contestID, participantID, userID, nomSlot)
	}
	if err != nil {
		return nil, err
	}
	if !isContestUserVotingModeLikes(mode) {
		postVotes, _ := s.repository.ListContestUserVotesByUser(ctx, contestID, userID)
		postVoteSlots := make([]map[string]any, 0, len(postVotes))
		for _, postVote := range postVotes {
			if postVote == nil {
				continue
			}
			postNom := ""
			if postVote.NominationID != nil {
				postNom = strings.TrimSpace(*postVote.NominationID)
			}
			postVoteSlots = append(postVoteSlots, map[string]any{
				"participantId": postVote.ParticipantID,
				"nominationId":  postNom,
			})
		}
		appendDebugVoteLog("H7", "service_vote:Vote", "Upsert contest_user_votes completed", map[string]any{
			"contestId":                 contestID,
			"userId":                    userID,
			"participantId":             participantID,
			"nominationId":              nomSlot,
			"previousParticipantInSlot": previousParticipantInSlot,
			"slotChangedParticipant":    previousParticipantInSlot != "" && previousParticipantInSlot != participantID,
			"postVoteSlots":             postVoteSlots,
		})
	}

	if isContestUserVotingModeLikes(mode) {
		s.pushWorkLikedNotification(ctx, contest, participant, userID)
	}

	if s.hub != nil {
		var contestTotalVotes int64
		var participantTotalVotes int64
		if isContestUserVotingModeLikes(mode) {
			contestTotalVotes, _ = s.repository.CountVotesByContest(ctx, contestID)
			participantTotalVotes, _ = s.repository.CountVotesByParticipant(ctx, participantID)
		} else {
			contestTotalVotes, _ = s.repository.CountContestUserVotesByContest(ctx, contestID)
			participantTotalVotes, _ = s.repository.CountContestUserVotesByParticipant(ctx, participantID)
		}
		payload := wsapp.VoteCountsUpdatedPayload{
			Type:                  wsapp.MessageTypeVoteCreated,
			ContestID:             contestID,
			ParticipantID:         participantID,
			ParticipantTotalVotes: participantTotalVotes,
			ContestTotalVotes:     contestTotalVotes,
		}
		appendDebugVoteLog("H6", "service_vote:Vote", "Broadcasting vote update", map[string]any{
			"contestId":             contestID,
			"participantId":         participantID,
			"userId":                userID,
			"mode":                  mode,
			"participantTotalVotes": participantTotalVotes,
			"contestTotalVotes":     contestTotalVotes,
			"nominationSlotNil":     nomSlot == nil,
		})
		_ = s.hub.BroadcastContestMessage(contestID, payload)
		if !isContestUserVotingModeLikes(mode) && previousParticipantInSlot != "" && previousParticipantInSlot != participantID {
			previousParticipantTotalVotes, _ := s.repository.CountContestUserVotesByParticipant(ctx, previousParticipantInSlot)
			prevPayload := wsapp.VoteCountsUpdatedPayload{
				Type:                  wsapp.MessageTypeVoteCreated,
				ContestID:             contestID,
				ParticipantID:         previousParticipantInSlot,
				ParticipantTotalVotes: previousParticipantTotalVotes,
				ContestTotalVotes:     contestTotalVotes,
			}
			appendDebugVoteLog("H8", "service_vote:Vote", "Broadcasting previous slot participant update", map[string]any{
				"contestId":                  contestID,
				"userId":                     userID,
				"newParticipantId":           participantID,
				"previousParticipantId":      previousParticipantInSlot,
				"previousParticipantVoteCnt": previousParticipantTotalVotes,
				"contestTotalVotes":          contestTotalVotes,
			})
			_ = s.hub.BroadcastContestMessage(contestID, prevPayload)
		}
		userPayload := wsapp.UserVoteUpdatedPayload{
			Type:          wsapp.MessageTypeUserVoteUpdated,
			ContestID:     contestID,
			ParticipantID: participantID,
			NominationID:  nomSlot,
		}
		appendDebugVoteLog("H6", "service_vote:Vote", "Sending user_vote_updated", map[string]any{
			"contestId":     contestID,
			"participantId": participantID,
			"userId":        userID,
			"nominationId":  nomSlot,
		})
		_ = s.hub.SendContestMessageToUser(contestID, userID, userPayload)
	}

	return vote, nil
}

func (s *TopPetService) pushWorkLikedNotification(ctx context.Context, contest *model.Contest, participant *model.Participant, voterID model.UserID) {
	if s == nil || contest == nil || participant == nil {
		return
	}
	if participant.UserID == voterID {
		return
	}
	authorName := ""
	if u, err := s.repository.GetUser(ctx, voterID); err == nil && u != nil {
		authorName = strings.TrimSpace(u.Name)
	}
	if authorName == "" {
		authorName = fmt.Sprintf("Пользователь %d", voterID)
	}
	_, _ = s.CreateAndPushUserNotification(ctx, participant.UserID, model.NotificationKindWorkLiked, map[string]any{
		"contest_id":     contest.ID,
		"contest_title":  contest.Title,
		"participant_id": participant.ID,
		"entry_title":    entryTitleForNotification(participant),
		"author_name":    authorName,
	})
}

func (s *TopPetService) ListUserVotesForContest(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if isContestUserVotingModeLikes(contest.UserVotingMode) {
		return s.repository.ListContestVotesByUser(ctx, contestID, userID)
	}
	return s.repository.ListContestUserVotesByUser(ctx, contestID, userID)
}

func (s *TopPetService) Unvote(ctx context.Context, contestID model.ContestID, userID model.UserID, participantID model.ParticipantID) (model.ParticipantID, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return "", err
	}

	mode := contest.UserVotingMode
	if isContestUserVotingModeLikes(mode) {
		if !publicVoteAllowedForContestPhase(contest.Status) {
			return "", fmt.Errorf("%w: public voting is only available during registration or voting phase", model.ErrBadRequest)
		}
		participantID, err = s.repository.DeleteContestVoteByUserAndParticipant(ctx, contestID, userID, participantID)
	} else {
		if !contestUserVoteAllowedForContestPhase(contest.Status) {
			return "", fmt.Errorf("%w: user voting is only available during voting phase", model.ErrBadRequest)
		}
		participantID, err = s.repository.DeleteContestUserVoteByUserAndParticipant(ctx, contestID, userID, participantID)
	}
	if err != nil {
		return "", err
	}

	if s.hub != nil {
		var contestTotalVotes int64
		if isContestUserVotingModeLikes(mode) {
			contestTotalVotes, _ = s.repository.CountVotesByContest(ctx, contestID)
		} else {
			contestTotalVotes, _ = s.repository.CountContestUserVotesByContest(ctx, contestID)
		}
		if participantID != "" {
			var participantTotalVotes int64
			if isContestUserVotingModeLikes(mode) {
				participantTotalVotes, _ = s.repository.CountVotesByParticipant(ctx, participantID)
			} else {
				participantTotalVotes, _ = s.repository.CountContestUserVotesByParticipant(ctx, participantID)
			}
			payload := wsapp.VoteCountsUpdatedPayload{
				Type:                  wsapp.MessageTypeVoteDeleted,
				ContestID:             contestID,
				ParticipantID:         participantID,
				ParticipantTotalVotes: participantTotalVotes,
				ContestTotalVotes:     contestTotalVotes,
			}
			appendDebugVoteLog("H6", "service_vote:Unvote", "Broadcasting unvote update", map[string]any{
				"contestId":             contestID,
				"participantId":         participantID,
				"userId":                userID,
				"mode":                  mode,
				"participantTotalVotes": participantTotalVotes,
				"contestTotalVotes":     contestTotalVotes,
			})
			_ = s.hub.BroadcastContestMessage(contestID, payload)
		}
		userPayload := wsapp.UserVoteUpdatedPayload{
			Type:          wsapp.MessageTypeUserVoteUpdated,
			ContestID:     contestID,
			ParticipantID: "",
			NominationID:  nil,
		}
		appendDebugVoteLog("H6", "service_vote:Unvote", "Sending user_vote_updated", map[string]any{
			"contestId":     contestID,
			"participantId": participantID,
			"userId":        userID,
			"nominationId":  nil,
		})
		_ = s.hub.SendContestMessageToUser(contestID, userID, userPayload)
	}

	return participantID, nil
}

func (s *TopPetService) ListVotersForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, viewer *model.UserID) ([]*model.VoterInfo, error) {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}
	if participant.ContestID != contestID {
		return nil, fmt.Errorf("%w", model.ErrorNotFound)
	}
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !s.participantVisible(ctx, participant, contest, viewer) {
		return nil, fmt.Errorf("%w", model.ErrorNotFound)
	}
	if isContestUserVotingModeLikes(contest.UserVotingMode) {
		return s.repository.ListVotersByParticipant(ctx, contestID, participantID)
	}
	return s.repository.ListContestUserVotersByParticipant(ctx, contestID, participantID)
}
