package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func (r *Repository) CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, petName, petDescription string) (*model.Participant, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID := uuid.New()
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	participant, err := reposqlc.CreateParticipant(ctx, &sqlc_repository.CreateParticipantParams{
		ID:             pgtype.UUID{Bytes: participantUUID, Valid: true},
		ContestID:      pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:         int64(userID),
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

	return &model.Participant{
		ID:             model.ParticipantID(participantIDStr),
		ContestID:      model.ContestID(contestIDStr),
		UserID:         model.UserID(participant.UserID),
		PetName:        participant.PetName,
		PetDescription: participant.PetDescription,
		CreatedAt:      participant.CreatedAt.Time,
		UpdatedAt:      participant.UpdatedAt.Time,
	}, nil
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

	return &model.Participant{
		ID:             model.ParticipantID(participantIDStr),
		ContestID:      model.ContestID(contestIDStr),
		UserID:         model.UserID(participant.UserID),
		PetName:        participant.PetName,
		PetDescription: participant.PetDescription,
		CreatedAt:      participant.CreatedAt.Time,
		UpdatedAt:      participant.UpdatedAt.Time,
	}, nil
}

func (r *Repository) AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, url string, thumbURL *string) (*model.Photo, error) {
	reposqlc := sqlc_repository.New(r.conn)
	photoUUID := uuid.New()
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	photo, err := reposqlc.AddParticipantPhoto(ctx, &sqlc_repository.AddParticipantPhotoParams{
		ID:            pgtype.UUID{Bytes: photoUUID, Valid: true},
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
		Url:           url,
		ThumbUrl:      thumbURL,
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
