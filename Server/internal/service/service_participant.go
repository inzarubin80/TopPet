package service

import (
	"context"
	"errors"
	"log"

	"toppet/server/internal/model"
)

func (s *TopPetService) CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, petName, petDescription string) (*model.Participant, error) {
	log.Printf("[Service] CreateParticipant: contestID=%s, userID=%d, petName=%s", contestID, userID, petName)
	
	if petName == "" {
		log.Printf("[Service] CreateParticipant: ERROR - pet_name is required")
		return nil, errors.New("pet_name is required")
	}

	// Check contest exists and is not finished
	log.Printf("[Service] CreateParticipant: Checking contest %s", contestID)
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		log.Printf("[Service] CreateParticipant: ERROR - Failed to get contest: %v", err)
		return nil, err
	}
	log.Printf("[Service] CreateParticipant: Contest found: status=%s", contest.Status)

	if contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] CreateParticipant: ERROR - Contest status does not allow adding participants")
		return nil, errors.New("can only add participants in draft or registration status")
	}

	// Create participant
	log.Printf("[Service] CreateParticipant: Creating participant in repository")
	participant, err := s.repository.CreateParticipant(ctx, contestID, userID, petName, petDescription)
	if err != nil {
		log.Printf("[Service] CreateParticipant: ERROR - Failed to create participant in repository: %v", err)
		return nil, err
	}
	log.Printf("[Service] CreateParticipant: Participant created successfully: participantID=%s", participant.ID)

	// Load photos and video
	log.Printf("[Service] CreateParticipant: Loading photos and video for participant %s", participant.ID)
	photos, _ := s.repository.GetPhotosByParticipantID(ctx, participant.ID)
	participant.Photos = photos
	log.Printf("[Service] CreateParticipant: Loaded %d photos", len(photos))

	video, _ := s.repository.GetVideoByParticipantID(ctx, participant.ID)
	if video != nil {
		participant.Video = video
		log.Printf("[Service] CreateParticipant: Loaded video: videoID=%s", video.ID)
	}

	log.Printf("[Service] CreateParticipant: Successfully created participant %s", participant.ID)
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

func (s *TopPetService) GetParticipantWithLikes(ctx context.Context, participantID model.ParticipantID, userID *model.UserID) (*model.Participant, error) {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	// Load photos and video
	photos, _ := s.repository.GetPhotosByParticipantID(ctx, participantID)
	participant.Photos = photos

	// Load photo likes if user is authenticated
	if userID != nil && len(photos) > 0 {
		photoIDs := make([]string, len(photos))
		for i, photo := range photos {
			photoIDs[i] = photo.ID
		}
		userLikes, err := s.repository.ListPhotoLikesByPhotos(ctx, photoIDs, *userID)
		if err != nil {
			log.Printf("[Service] GetParticipantWithLikes: Error loading photo likes: %v", err)
		}
		// Load like counts for all photos
		for _, photo := range photos {
			count, _ := s.repository.CountPhotoLikes(ctx, photo.ID)
			photo.LikeCount = &count
			if userLikes[photo.ID] != nil {
				isLiked := true
				photo.IsLiked = &isLiked
			} else {
				isLiked := false
				photo.IsLiked = &isLiked
			}
		}
	} else if len(photos) > 0 {
		// Load like counts even if user is not authenticated
		for _, photo := range photos {
			count, _ := s.repository.CountPhotoLikes(ctx, photo.ID)
			photo.LikeCount = &count
		}
	}

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
	log.Printf("[Service] UpdateParticipant: participantID=%s, userID=%d", participantID, userID)
	
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		log.Printf("[Service] UpdateParticipant: ERROR - Failed to get participant: %v", err)
		return nil, err
	}
	log.Printf("[Service] UpdateParticipant: Participant found: contestID=%s, ownerID=%d", participant.ContestID, participant.UserID)

	// Only owner can update
	if participant.UserID != userID {
		log.Printf("[Service] UpdateParticipant: ERROR - User %d is not the owner (owner is %d)", userID, participant.UserID)
		return nil, errors.New("only participant owner can update")
	}

	// Get contest to check status
	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] UpdateParticipant: ERROR - Failed to get contest: %v", err)
		return nil, err
	}
	log.Printf("[Service] UpdateParticipant: Contest found: status=%s", contest.Status)

	// Contest must be in draft or registration status
	if contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] UpdateParticipant: ERROR - Contest status does not allow updates (status=%s)", contest.Status)
		return nil, errors.New("can only update participant in draft or registration status")
	}

	log.Printf("[Service] UpdateParticipant: Updating participant in repository")
	updated, err := s.repository.UpdateParticipant(ctx, participantID, petName, petDescription)
	if err != nil {
		log.Printf("[Service] UpdateParticipant: ERROR - Failed to update participant: %v", err)
		return nil, err
	}
	log.Printf("[Service] UpdateParticipant: Participant updated successfully: participantID=%s", updated.ID)

	// Load photos and video
	log.Printf("[Service] UpdateParticipant: Loading photos and video for participant %s", updated.ID)
	photos, _ := s.repository.GetPhotosByParticipantID(ctx, updated.ID)
	updated.Photos = photos
	log.Printf("[Service] UpdateParticipant: Loaded %d photos", len(photos))

	video, _ := s.repository.GetVideoByParticipantID(ctx, updated.ID)
	if video != nil {
		updated.Video = video
		log.Printf("[Service] UpdateParticipant: Loaded video: videoID=%s", video.ID)
	}

	return updated, nil
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

	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusRegistration {
		return nil, errors.New("can only add photos during draft or registration")
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

	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusRegistration {
		return nil, errors.New("can only add videos during draft or registration")
	}

	return s.repository.UpsertParticipantVideo(ctx, participantID, url)
}

func (s *TopPetService) DeleteParticipant(ctx context.Context, participantID model.ParticipantID, userID model.UserID) error {
	log.Printf("[Service] DeleteParticipant: participantID=%s, userID=%d", participantID, userID)
	
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		log.Printf("[Service] DeleteParticipant: ERROR - Failed to get participant: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipant: Participant found: contestID=%s, ownerID=%d", participant.ContestID, participant.UserID)

	// Only owner can delete
	if participant.UserID != userID {
		log.Printf("[Service] DeleteParticipant: ERROR - User %d is not the owner (owner is %d)", userID, participant.UserID)
		return errors.New("only participant owner can delete")
	}

	// Get contest to check status
	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] DeleteParticipant: ERROR - Failed to get contest: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipant: Contest found: status=%s", contest.Status)

	// Contest must be in draft or registration status
	if contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] DeleteParticipant: ERROR - Contest status does not allow deletion (status=%s)", contest.Status)
		return errors.New("can only delete participant in draft or registration status")
	}

	log.Printf("[Service] DeleteParticipant: Deleting participant in repository")
	err = s.repository.DeleteParticipant(ctx, participantID)
	if err != nil {
		log.Printf("[Service] DeleteParticipant: ERROR - Failed to delete participant: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipant: Participant deleted successfully: participantID=%s", participantID)

	return nil
}

func (s *TopPetService) DeleteParticipantPhoto(ctx context.Context, participantID model.ParticipantID, photoID string, userID model.UserID) error {
	log.Printf("[Service] DeleteParticipantPhoto: participantID=%s, photoID=%s, userID=%d", participantID, photoID, userID)
	
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		log.Printf("[Service] DeleteParticipantPhoto: ERROR - Failed to get participant: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipantPhoto: Participant found: contestID=%s, ownerID=%d", participant.ContestID, participant.UserID)

	// Only owner can delete photos
	if participant.UserID != userID {
		log.Printf("[Service] DeleteParticipantPhoto: ERROR - User %d is not the owner (owner is %d)", userID, participant.UserID)
		return errors.New("only participant owner can delete photos")
	}

	// Get contest to check status
	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] DeleteParticipantPhoto: ERROR - Failed to get contest: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipantPhoto: Contest found: status=%s", contest.Status)

	// Contest must be in draft or registration status
	if contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] DeleteParticipantPhoto: ERROR - Contest status does not allow photo deletion (status=%s)", contest.Status)
		return errors.New("can only delete photos in draft or registration status")
	}

	log.Printf("[Service] DeleteParticipantPhoto: Deleting photo in repository")
	err = s.repository.DeleteParticipantPhoto(ctx, participantID, photoID)
	if err != nil {
		log.Printf("[Service] DeleteParticipantPhoto: ERROR - Failed to delete photo: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipantPhoto: Photo deleted successfully: photoID=%s", photoID)

	return nil
}

func (s *TopPetService) DeleteParticipantVideo(ctx context.Context, participantID model.ParticipantID, userID model.UserID) error {
	log.Printf("[Service] DeleteParticipantVideo: participantID=%s, userID=%d", participantID, userID)
	
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		log.Printf("[Service] DeleteParticipantVideo: ERROR - Failed to get participant: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipantVideo: Participant found: contestID=%s, ownerID=%d", participant.ContestID, participant.UserID)

	// Only owner can delete video
	if participant.UserID != userID {
		log.Printf("[Service] DeleteParticipantVideo: ERROR - User %d is not the owner (owner is %d)", userID, participant.UserID)
		return errors.New("only participant owner can delete video")
	}

	// Get contest to check status
	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] DeleteParticipantVideo: ERROR - Failed to get contest: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipantVideo: Contest found: status=%s", contest.Status)

	// Contest must be in draft or registration status
	if contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] DeleteParticipantVideo: ERROR - Contest status does not allow video deletion (status=%s)", contest.Status)
		return errors.New("can only delete video in draft or registration status")
	}

	// Delete video from repository
	err = s.repository.DeleteParticipantVideo(ctx, participantID)
	if err != nil {
		log.Printf("[Service] DeleteParticipantVideo: ERROR - Failed to delete video: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipantVideo: Video deleted successfully: participantID=%s", participantID)

	return nil
}

func (s *TopPetService) UpdateParticipantPhotoOrder(ctx context.Context, participantID model.ParticipantID, userID model.UserID, photoIDs []string) error {
	log.Printf("[Service] UpdateParticipantPhotoOrder: participantID=%s, userID=%d, photoCount=%d", participantID, userID, len(photoIDs))

	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - Failed to get participant: %v", err)
		return err
	}

	// Only owner can reorder photos
	if participant.UserID != userID {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - User %d is not the owner (owner is %d)", userID, participant.UserID)
		return errors.New("only participant owner can reorder photos")
	}

	contest, err := s.repository.GetContest(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - Failed to get contest: %v", err)
		return err
	}

	if contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - Contest status does not allow reordering (status=%s)", contest.Status)
		return errors.New("can only reorder photos in draft or registration status")
	}

	photos, err := s.repository.GetPhotosByParticipantID(ctx, participantID)
	if err != nil {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - Failed to get photos: %v", err)
		return err
	}

	existing := make(map[string]struct{}, len(photos))
	for _, photo := range photos {
		existing[photo.ID] = struct{}{}
	}

	if len(photoIDs) != len(photos) {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - photo_ids count mismatch: got=%d expected=%d", len(photoIDs), len(photos))
		return errors.New("photo_ids must include all participant photos")
	}

	seen := make(map[string]struct{}, len(photoIDs))
	for _, photoID := range photoIDs {
		if _, ok := existing[photoID]; !ok {
			log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - photoID does not belong to participant: %s", photoID)
			return errors.New("photo_id does not belong to participant")
		}
		if _, dup := seen[photoID]; dup {
			log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - duplicate photoID: %s", photoID)
			return errors.New("photo_ids must be unique")
		}
		seen[photoID] = struct{}{}
	}

	if err := s.repository.UpdateParticipantPhotoOrder(ctx, participantID, photoIDs); err != nil {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - Failed to update order: %v", err)
		return err
	}

	log.Printf("[Service] UpdateParticipantPhotoOrder: Order updated successfully")
	return nil
}
