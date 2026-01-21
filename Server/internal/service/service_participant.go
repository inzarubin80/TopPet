package service

import (
	"context"
	"errors"

	"toppet/server/internal/model"
)

func (s *TopPetService) CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, petName, petDescription string) (*model.Participant, error) {
	if petName == "" {
		return nil, errors.New("pet_name is required")
	}

	// Check contest exists and is not finished
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if contest.Status == model.ContestStatusFinished {
		return nil, errors.New("cannot add participant to finished contest")
	}

	// Check if participant already exists (MVP: 1 per user per contest)
	existing, err := s.repository.GetParticipantByContestAndUser(ctx, contestID, userID)
	if err == nil && existing != nil {
		return nil, errors.New("participant already exists for this user in this contest")
	}

	participant, err := s.repository.CreateParticipant(ctx, contestID, userID, petName, petDescription)
	if err != nil {
		return nil, err
	}

	// Load photos and video
	photos, _ := s.repository.GetPhotosByParticipantID(ctx, participant.ID)
	participant.Photos = photos

	video, _ := s.repository.GetVideoByParticipantID(ctx, participant.ID)
	if video != nil {
		participant.Video = video
	}

	return participant, nil
}

func (s *TopPetService) GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error) {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	// Load photos and video
	photos, _ := s.repository.GetPhotosByParticipantID(ctx, participantID)
	participant.Photos = photos

	video, _ := s.repository.GetVideoByParticipantID(ctx, participantID)
	if video != nil {
		participant.Video = video
	}

	// Add total votes count
	totalVotes, err := s.repository.CountVotesByParticipant(ctx, participantID)
	if err == nil {
		participant.TotalVotes = totalVotes
	}

	return participant, nil
}

func (s *TopPetService) ListParticipantsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Participant, error) {
	participants, err := s.repository.ListParticipantsByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	// Load photos, videos, and vote counts for each participant
	for _, p := range participants {
		photos, _ := s.repository.GetPhotosByParticipantID(ctx, p.ID)
		p.Photos = photos

		video, _ := s.repository.GetVideoByParticipantID(ctx, p.ID)
		if video != nil {
			p.Video = video
		}

		totalVotes, _ := s.repository.CountVotesByParticipant(ctx, p.ID)
		p.TotalVotes = totalVotes
	}

	return participants, nil
}

func (s *TopPetService) UpdateParticipant(ctx context.Context, participantID model.ParticipantID, userID model.UserID, petName, petDescription string) (*model.Participant, error) {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	// Only owner or contest admin can update
	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}

	if participant.UserID != userID && contest.CreatedByUserID != userID {
		return nil, errors.New("only participant owner or contest admin can update")
	}

	// Contest must not be finished
	if contest.Status == model.ContestStatusFinished {
		return nil, errors.New("cannot update participant in finished contest")
	}

	return s.repository.UpdateParticipant(ctx, participantID, petName, petDescription)
}

func (s *TopPetService) AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, userID model.UserID, url string, thumbURL *string) (*model.Photo, error) {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	// Only owner can add photos
	if participant.UserID != userID {
		return nil, errors.New("only participant owner can add photos")
	}

	return s.repository.AddParticipantPhoto(ctx, participantID, url, thumbURL)
}

func (s *TopPetService) AddParticipantVideo(ctx context.Context, participantID model.ParticipantID, userID model.UserID, url string) (*model.Video, error) {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	// Only owner can add video
	if participant.UserID != userID {
		return nil, errors.New("only participant owner can add video")
	}

	return s.repository.UpsertParticipantVideo(ctx, participantID, url)
}
