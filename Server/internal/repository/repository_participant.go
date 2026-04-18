package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func participantNominationPtr(n pgtype.UUID) *string {
	if !n.Valid {
		return nil
	}
	s := uuid.UUID(n.Bytes).String()
	return &s
}

func nominationPgFromOptional(nominationID *string) (pgtype.UUID, error) {
	if nominationID == nil {
		return pgtype.UUID{Valid: false}, nil
	}
	s := strings.TrimSpace(*nominationID)
	if s == "" {
		return pgtype.UUID{Valid: false}, nil
	}
	u, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}, err
	}
	return pgtype.UUID{Bytes: u, Valid: true}, nil
}

func normalizeParticipantLegacyFields(p *model.Participant) {
	if p == nil {
		return
	}
	if strings.TrimSpace(p.EntryTitle) == "" {
		p.EntryTitle = p.PetName
	}
	if strings.TrimSpace(p.EntryDescription) == "" {
		p.EntryDescription = p.PetDescription
	}
	if strings.TrimSpace(p.PetName) == "" {
		p.PetName = p.EntryTitle
	}
	if strings.TrimSpace(p.PetDescription) == "" {
		p.PetDescription = p.EntryDescription
	}
}

func listParticipantsNominationFilterParams(filter *model.ParticipantListNominationFilter) (mode string, filterID pgtype.UUID, err error) {
	if filter == nil {
		return "all", pgtype.UUID{}, nil
	}
	if filter.UnassignedOnly {
		return "none", pgtype.UUID{}, nil
	}
	s := strings.TrimSpace(filter.NominationID)
	if s == "" {
		return "all", pgtype.UUID{}, nil
	}
	u, parseErr := uuid.Parse(s)
	if parseErr != nil {
		return "", pgtype.UUID{}, parseErr
	}
	return "id", pgtype.UUID{Bytes: u, Valid: true}, nil
}

func (r *Repository) CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, entryTitle, entryDescription string, registrationAnswers map[string]interface{}, nominationID *string, policyVersion, consentIP, consentUserAgent string) (*model.Participant, error) {
	log.Printf("[Repository] CreateParticipant: contestID=%s, userID=%d, entryTitle=%s", contestID, userID, entryTitle)

	reposqlc := sqlc_repository.New(r.conn)
	participantUUID := uuid.New()
	log.Printf("[Repository] CreateParticipant: Generated participantUUID=%s", participantUUID.String())

	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		log.Printf("[Repository] CreateParticipant: ERROR - Failed to parse contestID: %v", err)
		return nil, err
	}
	log.Printf("[Repository] CreateParticipant: Parsed contestUUID=%s", contestUUID.String())

	ansBytes, err := registrationAnswersBytes(registrationAnswers)
	if err != nil {
		return nil, err
	}
	nomPg, err := nominationPgFromOptional(nominationID)
	if err != nil {
		return nil, err
	}
	log.Printf("[Repository] CreateParticipant: Executing SQL insert")
	participant, err := reposqlc.CreateParticipant(ctx, &sqlc_repository.CreateParticipantParams{
		ID:                  pgtype.UUID{Bytes: participantUUID, Valid: true},
		ContestID:           pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:              int64(userID),
		PetName:             entryTitle,
		PetDescription:      entryDescription,
		RegistrationAnswers: ansBytes,
		NominationID:        nomPg,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ErrAlreadyParticipatingInNomination
		}
		log.Printf("[Repository] CreateParticipant: ERROR - SQL insert failed: %v", err)
		return nil, err
	}
	if err := reposqlc.InsertParticipantConsentAudit(ctx, &sqlc_repository.InsertParticipantConsentAuditParams{
		ParticipantID: participant.ID,
		UserID:        int64(userID),
		ConsentType:   "privacy_processing",
		PolicyVersion: strings.TrimSpace(policyVersion),
		IpAddress:     strings.TrimSpace(consentIP),
		UserAgent:     strings.TrimSpace(consentUserAgent),
	}); err != nil {
		log.Printf("[Repository] CreateParticipant: ERROR - Failed to save consent audit: %v", err)
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
		ID:                  model.ParticipantID(participantIDStr),
		ContestID:           model.ContestID(contestIDStr),
		UserID:              model.UserID(participant.UserID),
		NominationID:        participantNominationPtr(participant.NominationID),
		SubmissionStatus:    participant.SubmissionStatus,
		SubmissionComment:   participant.SubmissionComment,
		PetName:             participant.PetName,
		PetDescription:      participant.PetDescription,
		EntryTitle:          participant.EntryTitle,
		EntryDescription:    participant.EntryDescription,
		RegistrationAnswers: parseRegistrationAnswers(participant.RegistrationAnswers),
		CreatedAt:           participant.CreatedAt.Time,
		UpdatedAt:           participant.UpdatedAt.Time,
	}
	normalizeParticipantLegacyFields(result)

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

	out := &model.Participant{
		ID:                  model.ParticipantID(participantIDStr),
		ContestID:           model.ContestID(contestIDStr),
		UserID:              model.UserID(participant.UserID),
		UserName:            participant.UserName,
		NominationID:        participantNominationPtr(participant.NominationID),
		SubmissionStatus:    participant.SubmissionStatus,
		SubmissionComment:   participant.SubmissionComment,
		PetName:             participant.PetName,
		PetDescription:      participant.PetDescription,
		EntryTitle:          participant.EntryTitle,
		EntryDescription:    participant.EntryDescription,
		RegistrationAnswers: parseRegistrationAnswers(participant.RegistrationAnswers),
		CommentCount:        participant.CommentCount,
		CreatedAt:           participant.CreatedAt.Time,
		UpdatedAt:           participant.UpdatedAt.Time,
	}
	normalizeParticipantLegacyFields(out)
	return out, nil
}

func (r *Repository) GetParticipantByContestUserAndNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID *string) (*model.Participant, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	nomPg, err := nominationPgFromOptional(nominationID)
	if err != nil {
		return nil, err
	}

	participant, err := reposqlc.GetParticipantByContestUserAndNomination(ctx, &sqlc_repository.GetParticipantByContestUserAndNominationParams{
		ContestID:    pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:       int64(userID),
		NominationID: nomPg,
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

	out := &model.Participant{
		ID:                  model.ParticipantID(participantIDStr),
		ContestID:           model.ContestID(contestIDStr),
		UserID:              model.UserID(participant.UserID),
		UserName:            participant.UserName,
		NominationID:        participantNominationPtr(participant.NominationID),
		SubmissionStatus:    participant.SubmissionStatus,
		SubmissionComment:   participant.SubmissionComment,
		PetName:             participant.PetName,
		PetDescription:      participant.PetDescription,
		EntryTitle:          participant.EntryTitle,
		EntryDescription:    participant.EntryDescription,
		RegistrationAnswers: parseRegistrationAnswers(participant.RegistrationAnswers),
		CommentCount:        participant.CommentCount,
		CreatedAt:           participant.CreatedAt.Time,
		UpdatedAt:           participant.UpdatedAt.Time,
	}
	normalizeParticipantLegacyFields(out)
	return out, nil
}

func (r *Repository) ListParticipantsByContest(ctx context.Context, contestID model.ContestID, viewer *model.UserID, includeAll bool, nominationFilter *model.ParticipantListNominationFilter, juryUnscoredOnly bool, participantScope string, submissionFilter string, votedByViewerOnly bool, favoriteOnly bool, limit, offset int32, listOrder string) ([]*model.Participant, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, 0, err
	}

	var viewerPtr *int64
	if viewer != nil {
		v := int64(*viewer)
		viewerPtr = &v
	}

	nomMode, nomID, nomErr := listParticipantsNominationFilterParams(nominationFilter)
	if nomErr != nil {
		return nil, 0, nomErr
	}

	cid := pgtype.UUID{Bytes: contestUUID, Valid: true}

	total, err := reposqlc.CountParticipantsByContest(ctx, &sqlc_repository.CountParticipantsByContestParams{
		ContestID:            cid,
		IncludeAll:           includeAll,
		ViewerUserID:         viewerPtr,
		NominationFilterMode: nomMode,
		NominationFilterID:   nomID,
		JuryUnscoredOnly:     juryUnscoredOnly,
		ParticipantScope:     participantScope,
		SubmissionFilter:     submissionFilter,
		VotedByViewerOnly:    votedByViewerOnly,
		FavoriteOnly:         favoriteOnly,
	})
	if err != nil {
		return nil, 0, err
	}

	participants, err := reposqlc.ListParticipantsByContest(ctx, &sqlc_repository.ListParticipantsByContestParams{
		ContestID:            cid,
		IncludeAll:           includeAll,
		ViewerUserID:         viewerPtr,
		NominationFilterMode: nomMode,
		NominationFilterID:   nomID,
		JuryUnscoredOnly:     juryUnscoredOnly,
		ParticipantScope:     participantScope,
		SubmissionFilter:     submissionFilter,
		VotedByViewerOnly:    votedByViewerOnly,
		FavoriteOnly:         favoriteOnly,
		ListOrder:            listOrder,
		ListOffset:           offset,
		ListLimit:            limit,
	})
	if err != nil {
		return nil, 0, err
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
			ID:                  model.ParticipantID(participantIDStr),
			ContestID:           model.ContestID(contestIDStr),
			UserID:              model.UserID(p.UserID),
			UserName:            p.UserName,
			NominationID:        participantNominationPtr(p.NominationID),
			SubmissionStatus:    p.SubmissionStatus,
			SubmissionComment:   p.SubmissionComment,
			PetName:             p.PetName,
			PetDescription:      p.PetDescription,
			EntryTitle:          p.EntryTitle,
			EntryDescription:    p.EntryDescription,
			RegistrationAnswers: parseRegistrationAnswers(p.RegistrationAnswers),
			CommentCount:        p.CommentCount,
			CreatedAt:           p.CreatedAt.Time,
			UpdatedAt:           p.UpdatedAt.Time,
		}
		normalizeParticipantLegacyFields(result[i])
	}

	return result, total, nil
}

func (r *Repository) UpdateParticipant(ctx context.Context, participantID model.ParticipantID, entryTitle, entryDescription string, registrationAnswers map[string]interface{}) (*model.Participant, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}

	ansBytes, err := registrationAnswersBytes(registrationAnswers)
	if err != nil {
		return nil, err
	}
	participant, err := reposqlc.UpdateParticipant(ctx, &sqlc_repository.UpdateParticipantParams{
		ID:                  pgtype.UUID{Bytes: participantUUID, Valid: true},
		PetName:             entryTitle,
		PetDescription:      entryDescription,
		RegistrationAnswers: ansBytes,
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
		ID:                  model.ParticipantID(participantIDStr),
		ContestID:           model.ContestID(contestIDStr),
		UserID:              model.UserID(participant.UserID),
		NominationID:        participantNominationPtr(participant.NominationID),
		SubmissionStatus:    participant.SubmissionStatus,
		SubmissionComment:   participant.SubmissionComment,
		PetName:             participant.PetName,
		PetDescription:      participant.PetDescription,
		EntryTitle:          participant.EntryTitle,
		EntryDescription:    participant.EntryDescription,
		RegistrationAnswers: parseRegistrationAnswers(participant.RegistrationAnswers),
		CreatedAt:           participant.CreatedAt.Time,
		UpdatedAt:           participant.UpdatedAt.Time,
	}
	normalizeParticipantLegacyFields(result)

	user, err := r.GetUser(ctx, model.UserID(participant.UserID))
	if err == nil && user != nil {
		result.UserName = user.Name
	}

	return result, nil
}

func (r *Repository) MarkParticipantSubmissionPending(ctx context.Context, participantID model.ParticipantID) error {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return err
	}
	return reposqlc.MarkParticipantSubmissionPending(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true})
}

func (r *Repository) SetParticipantSubmissionStatus(ctx context.Context, participantID model.ParticipantID, status string, submissionComment *string) (*model.Participant, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return nil, err
	}
	commentSQL := ""
	if status == model.ParticipantSubmissionRejected && submissionComment != nil {
		commentSQL = *submissionComment
	}
	participant, err := reposqlc.SetParticipantSubmissionStatus(ctx, &sqlc_repository.SetParticipantSubmissionStatusParams{
		ID:               pgtype.UUID{Bytes: participantUUID, Valid: true},
		SubmissionStatus: status,
		Column3:          commentSQL,
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

	result := &model.Participant{
		ID:                  model.ParticipantID(participantIDStr),
		ContestID:           model.ContestID(contestIDStr),
		UserID:              model.UserID(participant.UserID),
		NominationID:        participantNominationPtr(participant.NominationID),
		SubmissionStatus:    participant.SubmissionStatus,
		SubmissionComment:   participant.SubmissionComment,
		PetName:             participant.PetName,
		PetDescription:      participant.PetDescription,
		EntryTitle:          participant.EntryTitle,
		EntryDescription:    participant.EntryDescription,
		RegistrationAnswers: parseRegistrationAnswers(participant.RegistrationAnswers),
		CreatedAt:           participant.CreatedAt.Time,
		UpdatedAt:           participant.UpdatedAt.Time,
	}
	normalizeParticipantLegacyFields(result)
	user, err := r.GetUser(ctx, model.UserID(participant.UserID))
	if err == nil && user != nil {
		result.UserName = user.Name
	}
	return result, nil
}

func (r *Repository) DeleteParticipant(ctx context.Context, participantID model.ParticipantID) error {
	return r.deleteParticipant(ctx, r.conn, participantID)
}

func (r *Repository) deleteParticipant(ctx context.Context, conn DBTX, participantID model.ParticipantID) error {
	log.Printf("[Repository] DeleteParticipant: participantID=%s", participantID)

	reposqlc := sqlc_repository.New(conn)
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

	if err := reposqlc.DeleteParticipantFavoritesByParticipantID(ctx, pgtype.UUID{Bytes: participantUUID, Valid: true}); err != nil {
		log.Printf("[Repository] DeleteParticipant: WARNING - Failed to delete favorites: %v", err)
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

func (r *Repository) IsParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) (bool, error) {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return false, err
	}
	return reposqlc.IsParticipantFavorite(ctx, &sqlc_repository.IsParticipantFavoriteParams{
		UserID:        int64(userID),
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
	})
}

func (r *Repository) UpsertParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) error {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return err
	}
	return reposqlc.UpsertParticipantFavorite(ctx, &sqlc_repository.UpsertParticipantFavoriteParams{
		UserID:        int64(userID),
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
	})
}

func (r *Repository) DeleteParticipantFavorite(ctx context.Context, userID model.UserID, participantID model.ParticipantID) error {
	reposqlc := sqlc_repository.New(r.conn)
	participantUUID, err := uuid.Parse(string(participantID))
	if err != nil {
		return err
	}
	return reposqlc.DeleteParticipantFavorite(ctx, &sqlc_repository.DeleteParticipantFavoriteParams{
		UserID:        int64(userID),
		ParticipantID: pgtype.UUID{Bytes: participantUUID, Valid: true},
	})
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
