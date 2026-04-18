package service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"toppet/server/internal/model"
)

const maxSubmissionCommentRunes = 2000

func (s *TopPetService) SetParticipantSubmissionStatus(ctx context.Context, participantID model.ParticipantID, actorID model.UserID, status string, submissionComment *string) (*model.Participant, error) {
	if status != model.ParticipantSubmissionAccepted && status != model.ParticipantSubmissionRejected {
		return nil, errors.New("submission_status must be accepted or rejected")
	}
	if status == model.ParticipantSubmissionRejected {
		if submissionComment == nil || strings.TrimSpace(*submissionComment) == "" {
			return nil, errors.New("submission_comment is required when rejecting")
		}
		if utf8.RuneCountInString(strings.TrimSpace(*submissionComment)) > maxSubmissionCommentRunes {
			return nil, errors.New("submission_comment is too long (max 2000 characters)")
		}
	}
	p, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}
	contest, err := s.getContestForBusiness(ctx, p.ContestID)
	if err != nil {
		return nil, err
	}
	if !s.userCanManageContest(ctx, contest, actorID) {
		return nil, model.ErrorForbidden
	}
	if status == model.ParticipantSubmissionAccepted {
		if err := s.ensureParticipantPhotoCountInBounds(ctx, p); err != nil {
			return nil, err
		}
	}
	var commentArg *string
	if status == model.ParticipantSubmissionRejected && submissionComment != nil {
		t := strings.TrimSpace(*submissionComment)
		commentArg = &t
	}
	updated, err := s.repository.SetParticipantSubmissionStatus(ctx, participantID, status, commentArg)
	if err != nil {
		return nil, err
	}
	photos, _ := s.repository.GetPhotosByParticipantID(ctx, participantID)
	updated.Photos = photos
	totalVotes, _ := s.repository.CountVotesByParticipant(ctx, participantID)
	updated.TotalVotes = totalVotes
	if status == model.ParticipantSubmissionRejected && commentArg != nil {
		s.postSubmissionRejectionToContestChat(ctx, contest, updated, actorID, *commentArg)
	}
	s.broadcastParticipantUpdated(ctx, participantID)
	return updated, nil
}
