package service

import (
	"context"

	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

// participantPayloadForBroadcast — поля заявки для карточки в галерее (лайки, комментарии, фото, жюри/призы).
func (s *TopPetService) participantPayloadForBroadcast(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error) {
	p, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}
	contest, err := s.getContestForBusiness(ctx, p.ContestID)
	if err != nil {
		return nil, err
	}
	photos, _ := s.repository.GetPhotosByParticipantID(ctx, participantID)
	p.Photos = photos
	tv, _ := s.repository.CountVotesByParticipant(ctx, participantID)
	p.TotalVotes = tv
	_, cc, _ := s.repository.ListCommentsByParticipant(ctx, participantID, nil, 1, 0)
	p.CommentCount = cc
	s.attachOneParticipantJuryScoreTotal(ctx, contest, nil, p)
	s.attachOneParticipantWinnerFlags(ctx, contest, p)
	return p, nil
}

func (s *TopPetService) broadcastParticipantUpdated(ctx context.Context, participantID model.ParticipantID) {
	if s.hub == nil {
		return
	}
	p, err := s.participantPayloadForBroadcast(ctx, participantID)
	if err != nil {
		return
	}
	payload := wsapp.ParticipantUpdatedPayload{
		Type:        wsapp.MessageTypeParticipantUpdated,
		ContestID:   p.ContestID,
		Participant: p,
	}
	_ = s.hub.BroadcastContestMessage(p.ContestID, payload)
}

func (s *TopPetService) broadcastParticipantDeleted(contestID model.ContestID, participantID model.ParticipantID) {
	if s.hub == nil {
		return
	}
	payload := wsapp.ParticipantDeletedPayload{
		Type:            wsapp.MessageTypeParticipantDeleted,
		ContestID:       contestID,
		ParticipantID:   participantID,
	}
	_ = s.hub.BroadcastContestMessage(contestID, payload)
}
