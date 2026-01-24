package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func (r *Repository) CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, petName, petDescription string) (*model.Participant, error) {
	log.Printf("[Repository] CreateParticipant: contestID=%s, userID=%d, petName=%s", contestID, userID, petName)
	
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID := uuid.New()
	log.Printf("[Repository] CreateParticipant: Generated participantUUID=%s", participantUUID.String())
	
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		log.Printf("[Repository] CreateParticipant: ERROR - Failed to parse contestID: %v", err)
		return nil, err
	}
	log.Printf("[Repository] CreateParticipant: Parsed contestUUID=%s", contestUUID.String())

	log.Printf("[Repository] CreateParticipant: Executing SQL insert")
	participant, err := reposqlc.CreateParticipant(ctx, &sqlc_repository.CreateParticipantParams{
		ID:             pgtype.UUID{Bytes: participantUUID, Valid: true},
		ContestID:      pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:         int64(userID),
		PetName:        petName,
		PetDescription: petDescription,
	})
	if err != nil {
		log.Printf("[Repository] CreateParticipant: ERROR - SQL insert failed: %v", err)
		return nil, err
	}
	log.Printf("[Repository] CreateParticipant: SQL insert successful, participantID=%s", participant.ID.String())

	var participantIDStr, contestIDStr string
	if participant.ID.Valid {
		participantIDStr = uuid.UUID(participant.ID.Bytes).String()
	}
	if participant.ContestID.Valid {
		contestIDStr = uuid.UUID(participant.ContestID.Bytes).String()
	}

	result := &model.Participant{
		ID:             model.ParticipantID(participantIDStr),
		ContestID:      model.ContestID(contestIDStr),
		UserID:         model.UserID(participant.UserID),
		PetName:        participant.PetName,
		PetDescription: participant.PetDescription,
		CreatedAt:      participant.CreatedAt.Time,
		UpdatedAt:      participant.UpdatedAt.Time,
	}

	user, err := r.GetUser(ctx, model.UserID(participant.UserID))
	if err == nil && user != nil {
		result.UserName = user.Name
	}
	
	log.Printf("[Repository] CreateParticipant: Successfully created participant: ID=%s, ContestID=%s, UserID=%d", result.ID, result.ContestID, result.UserID)
	return result, nil
}

func (r *Repository) GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	participant, err := reposqlc.GetParticipantByID(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	var participantIDStr, contestIDStr string
	if participant.ID.Valid {
		participantIDStr = uuid.UUID(participant.ID.Bytes).String()
	}
	if participant.ContestID.Valid {
		contestIDStr = uuid.UUID(participant.ContestID.Bytes).String()
	}

	return &model.Participant{
		ID:             model.ParticipantID(participantIDStr),
		ContestID:      model.ContestID(contestIDStr),
		UserID:         model.UserID(participant.UserID),
		UserName:       participant.UserName,
		PetName:        participant.PetName,
		PetDescription: participant.PetDescription,
		CreatedAt:      participant.CreatedAt.Time,
		UpdatedAt:      participant.UpdatedAt.Time,
	}, nil
}

func (r *Repository) GetParticipantByContestAndUser(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Participant, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	participant, err := reposqlc.GetParticipantByContestAndUser(ctx, &sqlc_repository.GetParticipantByContestAndUserParams{
		ContestID: pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:    int64(userID),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	var participantIDStr, contestIDStr string
	if participant.ID.Valid {
		participantIDStr = uuid.UUID(participant.ID.Bytes).String()
	}
	if participant.ContestID.Valid {
		contestIDStr = uuid.UUID(participant.ContestID.Bytes).String()
	}

	return &model.Participant{
		ID:             model.ParticipantID(participantIDStr),
		ContestID:      model.ContestID(contestIDStr),
		UserID:         model.UserID(participant.UserID),
		UserName:       participant.UserName,
		PetName:        participant.PetName,
		PetDescription: participant.PetDescription,
		CreatedAt:      participant.CreatedAt.Time,
		UpdatedAt:      participant.UpdatedAt.Time,
	}, nil
}

func (r *Repository) ListParticipantsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Participant, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	participants, err := reposqlc.ListParticipantsByContest(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
	if err != nil {
		return nil, err
	}

	result := make([]*model.Participant, len(participants))
	for i, p := range participants {
		var participantIDStr, contestIDStr string
		if p.ID.Valid {
			participantIDStr = uuid.UUID(p.ID.Bytes).String()
		}
		if p.ContestID.Valid {
			contestIDStr = uuid.UUID(p.ContestID.Bytes).String()
		}

		result[i] = &model.Participant{
			ID:             model.ParticipantID(participantIDStr),
			ContestID:      model.ContestID(contestIDStr),
			UserID:         model.UserID(p.UserID),
			UserName:       p.UserName,
			PetName:        p.PetName,
			PetDescription: p.PetDescription,
			CreatedAt:      p.CreatedAt.Time,
			UpdatedAt:      p.UpdatedAt.Time,
		}
	}

	return result, nil
}

func (r *Repository) UpdateParticipant(ctx context.Context, participantID model.ParticipantID, petName, petDescription string) (*model.Participant, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	participant, err := reposqlc.UpdateParticipant(ctx, &sqlc_repository.UpdateParticipantParams{
		ID:             pgtype.UUID{Bytes: participantUUID, Valid: true},
		PetName:        petName,
		PetDescription: petDescription,
	})
	if err != nil {
		return nil, err
	}

	var participantIDStr, contestIDStr string
	if participant.ID.Valid {
		participantIDStr = uuid.UUID(participant.ID.Bytes).String()
	}
	if participant.ContestID.Valid {
		contestIDStr = uuid.UUID(participant.ContestID.Bytes).String()
	}

	result := &model.Participant{
		ID:             model.ParticipantID(participantIDStr),
		ContestID:      model.ContestID(contestIDStr),
		UserID:         model.UserID(participant.UserID),
		PetName:        participant.PetName,
		PetDescription: participant.PetDescription,
		CreatedAt:      participant.CreatedAt.Time,
		UpdatedAt:      participant.UpdatedAt.Time,
	}

	user, err := r.GetUser(ctx, model.UserID(participant.UserID))
	if err == nil && user != nil {
		result.UserName = user.Name
	}

	return result, nil
}

func (r *Repository) DeleteParticipant(ctx context.Context, participantID model.ParticipantID) error {
	log.Printf("[Repository] DeleteParticipant: participantID=%s", participantID)
	
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		log.Printf("[Repository] DeleteParticipant: ERROR - Failed to parse participantID: %v", err)
		return err
	}

	// Delete all related data first (no foreign keys, so we delete manually)
	// Delete photos
	log.Printf("[Repository] DeleteParticipant: Deleting photos for participant %s", participantID)
	photos, err := reposqlc.GetPhotosByParticipantID(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	if err == nil {
		for _, photo := range photos {
			if photo.ID.Valid {
				if err := reposqlc.DeleteParticipantPhoto(ctx, photo.ID); err != nil {
					log.Printf("[Repository] DeleteParticipant: WARNING - Failed to delete photo %s: %v", photo.ID.String(), err)
				}
			}
		}
	}

	// Delete video
	log.Printf("[Repository] DeleteParticipant: Deleting video for participant %s", participantID)
	if err := reposqlc.DeleteParticipantVideo(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true}); err != nil {
		log.Printf("[Repository] DeleteParticipant: WARNING - Failed to delete video: %v", err)
	}

	// Delete comments
	log.Printf("[Repository] DeleteParticipant: Deleting comments for participant %s", participantID)
	if err := reposqlc.DeleteCommentsByParticipant(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true}); err != nil {
		log.Printf("[Repository] DeleteParticipant: WARNING - Failed to delete comments: %v", err)
	}

	// Delete votes
	log.Printf("[Repository] DeleteParticipant: Deleting votes for participant %s", participantID)
	if err := reposqlc.DeleteVotesByParticipant(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true}); err != nil {
		log.Printf("[Repository] DeleteParticipant: WARNING - Failed to delete votes: %v", err)
	}

	// Delete participant
	log.Printf("[Repository] DeleteParticipant: Deleting participant %s", participantID)
	err = reposqlc.DeleteParticipant(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	if err != nil {
		log.Printf("[Repository] DeleteParticipant: ERROR - Failed to delete participant: %v", err)
		return err
	}

	log.Printf("[Repository] DeleteParticipant: Successfully deleted participant %s", participantID)
	return nil
}

func (r *Repository) AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, url string, thumbURL *string) (*model.Photo, error) {
	reposqlc := sqlc_repository.New(r.conn)
	photoUUID := uuid.New()
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	maxPosition, err := reposqlc.GetMaxPhotoPositionByParticipant(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	if err != nil {
		return nil, err
	}
	maxPosInt, ok := maxPosition.(int64)
	if !ok {
		maxPosInt = 0
	}
	nextPosition := int32(maxPosInt + 1)

	photo, err := reposqlc.AddParticipantPhoto(ctx, &sqlc_repository.AddParticipantPhotoParams{
		ID:            pgtype.UUID{Bytes: photoUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		Url:           url,
		ThumbUrl:      thumbURL,
		Position:      nextPosition,
	})
	if err != nil {
		return nil, err
	}

	var photoIDStr, participantIDStr string
	if photo.ID.Valid {
		photoIDStr = uuid.UUID(photo.ID.Bytes).String()
	}
	if photo.ParticipantID.Valid {
		participantIDStr = uuid.UUID(photo.ParticipantID.Bytes).String()
	}

	result := &model.Photo{
		ID:            photoIDStr,
		ParticipantID: model.ParticipantID(participantIDStr),
		URL:           photo.Url,
		Position:      int(photo.Position),
		CreatedAt:     photo.CreatedAt.Time,
	}
	if photo.ThumbUrl != nil {
		result.ThumbURL = photo.ThumbUrl
	}

	return result, nil
}

func (r *Repository) GetPhotosByParticipantID(ctx context.Context, participantID model.ParticipantID) ([]*model.Photo, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	photos, err := reposqlc.GetPhotosByParticipantID(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	if err != nil {
		return nil, err
	}

	result := make([]*model.Photo, len(photos))
	for i, p := range photos {
		var photoIDStr, participantIDStr string
		if p.ID.Valid {
			photoIDStr = uuid.UUID(p.ID.Bytes).String()
		}
		if p.ParticipantID.Valid {
			participantIDStr = uuid.UUID(p.ParticipantID.Bytes).String()
		}

		result[i] = &model.Photo{
			ID:            photoIDStr,
			ParticipantID: model.ParticipantID(participantIDStr),
			URL:           p.Url,
			Position:      int(p.Position),
			CreatedAt:     p.CreatedAt.Time,
		}
		if p.ThumbUrl != nil {
			result[i].ThumbURL = p.ThumbUrl
		}
	}

	return result, nil
}

func (r *Repository) UpsertParticipantVideo(ctx context.Context, participantID model.ParticipantID, url string) (*model.Video, error) {
	reposqlc := sqlc_repository.New(r.conn)
	videoUUID := uuid.New()
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	video, err := reposqlc.UpsertParticipantVideo(ctx, &sqlc_repository.UpsertParticipantVideoParams{
		ID:            pgtype.UUID{Bytes: videoUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		Url:           url,
	})
	if err != nil {
		return nil, err
	}

	var videoIDStr, participantIDStr string
	if video.ID.Valid {
		videoIDStr = uuid.UUID(video.ID.Bytes).String()
	}
	if video.ParticipantID.Valid {
		participantIDStr = uuid.UUID(video.ParticipantID.Bytes).String()
	}

	return &model.Video{
		ID:            videoIDStr,
		ParticipantID: model.ParticipantID(participantIDStr),
		URL:           video.Url,
		CreatedAt:     video.CreatedAt.Time,
		UpdatedAt:     video.CreatedAt.Time, // Video table doesn't have updated_at, use CreatedAt
	}, nil
}

func (r *Repository) GetVideoByParticipantID(ctx context.Context, participantID model.ParticipantID) (*model.Video, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	video, err := reposqlc.GetVideoByParticipantID(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	var videoIDStr, participantIDStr string
	if video.ID.Valid {
		videoIDStr = uuid.UUID(video.ID.Bytes).String()
	}
	if video.ParticipantID.Valid {
		participantIDStr = uuid.UUID(video.ParticipantID.Bytes).String()
	}

	return &model.Video{
		ID:            videoIDStr,
		ParticipantID: model.ParticipantID(participantIDStr),
		URL:           video.Url,
		CreatedAt:     video.CreatedAt.Time,
		UpdatedAt:     video.CreatedAt.Time, // Video table doesn't have updated_at, use CreatedAt
	}, nil
}

func (r *Repository) DeleteParticipantPhoto(ctx context.Context, participantID model.ParticipantID, photoID string) error {
	reposqlc := sqlc_repository.New(r.conn)
	photoUUID, err := uuid.Parse(photoID)
	if err != nil {
		return err
	}

	err = reposqlc.DeleteParticipantPhoto(ctx, pgtype.UUID{Bytes: photoUUID, Valid: true})
	if err != nil {
		return err
	}

	return nil
}

func (r *Repository) DeleteParticipantVideo(ctx context.Context, participantID model.ParticipantID) error {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return err
	}

	err = reposqlc.DeleteParticipantVideo(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
	if err != nil {
		return err
	}

	return nil
}

func (r *Repository) UpdateParticipantPhotoOrder(ctx context.Context, participantID model.ParticipantID, photoIDs []string) error {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return err
	}

	for index, photoID := range photoIDs {
		photoUUID, err := uuid.Parse(photoID)
		if err != nil {
			return err
		}

		err = reposqlc.UpdateParticipantPhotoOrder(ctx, &sqlc_repository.UpdateParticipantPhotoOrderParams{
			ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
			ID:            pgtype.UUID{Bytes: photoUUID, Valid: true},
			Position:      int32(index + 1),
		})
		if err != nil {
			return err
		}
	}

	return nil
}
