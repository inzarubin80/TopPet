package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"toppet/server/internal/model"
)

func normalizeParticipantListSubmissionFilter(includeAll bool, raw string) (string, error) {
	s := strings.TrimSpace(strings.ToLower(raw))
	if s == "" {
		s = model.ParticipantListSubmissionAll
	}
	if !includeAll {
		return model.ParticipantListSubmissionAll, nil
	}
	switch s {
	case model.ParticipantListSubmissionAll, model.ParticipantListSubmissionAccepted, model.ParticipantListSubmissionPending, model.ParticipantListSubmissionRejected, model.ParticipantListSubmissionNonAccepted:
		return s, nil
	default:
		return "", fmt.Errorf("%w: invalid submission_filter", model.ErrBadRequest)
	}
}

func (s *TopPetService) participantVisible(ctx context.Context, p *model.Participant, contest *model.Contest, viewer *model.UserID) bool {
	st := p.SubmissionStatus
	if st == "" {
		st = model.ParticipantSubmissionAccepted
	}
	if st == model.ParticipantSubmissionAccepted {
		return true
	}
	if viewer != nil && p.UserID == *viewer {
		return true
	}
	if viewer != nil && s.userCanManageContest(ctx, contest, *viewer) {
		return true
	}
	if viewer != nil && contest.JuryVotingEnabled && contest.Status != model.ContestStatusDraft && contest.Status != model.ContestStatusPublication {
		ok, err := s.repository.IsContestJuryMember(ctx, contest.ID, *viewer)
		if err == nil && ok {
			return true
		}
	}
	return false
}

// resolveParticipantEntryTitle возвращает непустой заголовок заявки: из запроса или из профиля пользователя.
func (s *TopPetService) resolveParticipantEntryTitle(ctx context.Context, userID model.UserID, entryTitle string) (string, error) {
	if t := strings.TrimSpace(entryTitle); t != "" {
		return t, nil
	}
	u, err := s.repository.GetUser(ctx, userID)
	if err != nil {
		return "", err
	}
	if n := strings.TrimSpace(u.Name); n != "" {
		return n, nil
	}
	if em := strings.TrimSpace(u.Email); em != "" {
		if i := strings.IndexByte(em, '@'); i > 0 {
			return strings.TrimSpace(em[:i]), nil
		}
	}
	return "Участник", nil
}

func (s *TopPetService) CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, entryTitle, entryDescription string, registrationAnswers map[string]interface{}, nominationID *string, policyVersion, consentIP, consentUserAgent string) (*model.Participant, error) {
	log.Printf("[Service] CreateParticipant: contestID=%s, userID=%d, entryTitle=%s", contestID, userID, entryTitle)

	// Check contest exists and is not finished
	log.Printf("[Service] CreateParticipant: Checking contest %s", contestID)
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		log.Printf("[Service] CreateParticipant: ERROR - Failed to get contest: %v", err)
		return nil, err
	}
	log.Printf("[Service] CreateParticipant: Contest found: status=%s", contest.Status)

	if contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] CreateParticipant: ERROR - Contest status does not allow adding participants (status=%s)", contest.Status)
		return nil, fmt.Errorf("%w: can only submit participation during registration", model.ErrBadRequest)
	}

	ans := registrationAnswers
	if ans == nil {
		ans = map[string]interface{}{}
	}
	fields, err := s.repository.ListRegistrationFieldsByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if err := ValidateRegistrationAnswers(fields, ans); err != nil {
		return nil, err
	}

	nCount, err := s.repository.CountNominationsByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	var effectiveNom *string
	if nCount > 0 {
		if nominationID == nil || strings.TrimSpace(*nominationID) == "" {
			return nil, errors.New("nomination_id is required when the contest has nominations")
		}
		trimmed := strings.TrimSpace(*nominationID)
		effectiveNom = &trimmed
		if _, err := s.repository.GetNominationByContest(ctx, contestID, trimmed); err != nil {
			if errors.Is(err, model.ErrorNotFound) {
				return nil, errors.New("nomination not found")
			}
			return nil, err
		}
	} else {
		if nominationID != nil && strings.TrimSpace(*nominationID) != "" {
			return nil, errors.New("nomination_id must not be set when the contest has no nominations")
		}
	}

	existing, err := s.repository.GetParticipantByContestUserAndNomination(ctx, contestID, userID, effectiveNom)
	if err != nil && !errors.Is(err, model.ErrorNotFound) {
		return nil, err
	}
	if existing != nil {
		if nCount > 0 {
			return nil, model.ErrAlreadyParticipatingInNomination
		}
		return nil, model.ErrAlreadyParticipatingInContest
	}

	if len(contest.ParticipantAllowedEmailDomains) > 0 && !s.userCanManageContest(ctx, contest, userID) {
		u, uerr := s.repository.GetUser(ctx, userID)
		if uerr != nil {
			return nil, uerr
		}
		em := strings.TrimSpace(u.Email)
		if em == "" || !model.EmailDomainMatchesAllowlist(em, contest.ParticipantAllowedEmailDomains) {
			return nil, model.ErrParticipantEmailDomainNotAllowed
		}
	}

	resolvedName, err := s.resolveParticipantEntryTitle(ctx, userID, entryTitle)
	if err != nil {
		return nil, err
	}
	policyVersion = strings.TrimSpace(policyVersion)
	if policyVersion == "" {
		return nil, fmt.Errorf("%w: policy_version is required", model.ErrBadRequest)
	}
	entryTitle = resolvedName
	entryDescription = strings.TrimSpace(entryDescription)
	consentIP = strings.TrimSpace(consentIP)
	consentUserAgent = strings.TrimSpace(consentUserAgent)

	// Create participant
	log.Printf("[Service] CreateParticipant: Creating participant in repository")
	participant, err := s.repository.CreateParticipant(
		ctx,
		contestID,
		userID,
		entryTitle,
		entryDescription,
		ans,
		effectiveNom,
		policyVersion,
		consentIP,
		consentUserAgent,
	)
	if err != nil {
		log.Printf("[Service] CreateParticipant: ERROR - Failed to create participant in repository: %v", err)
		return nil, err
	}
	log.Printf("[Service] CreateParticipant: Participant created successfully: participantID=%s", participant.ID)

	photos, _ := s.repository.GetPhotosByParticipantID(ctx, participant.ID)
	participant.Photos = photos
	log.Printf("[Service] CreateParticipant: Loaded %d photos for participant %s", len(photos), participant.ID)

	log.Printf("[Service] CreateParticipant: Successfully created participant %s", participant.ID)
	return participant, nil
}

func (s *TopPetService) GetParticipant(ctx context.Context, participantID model.ParticipantID, viewer *model.UserID) (*model.Participant, error) {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if !s.participantVisible(ctx, participant, contest, viewer) {
		return nil, fmt.Errorf("%w", model.ErrorNotFound)
	}

	photos, _ := s.repository.GetPhotosByParticipantID(ctx, participantID)
	participant.Photos = photos

	// Add total votes count
	totalVotes, err := s.repository.CountVotesByParticipant(ctx, participantID)
	if err == nil {
		participant.TotalVotes = totalVotes
	}

	s.attachOneParticipantJuryScoreTotal(ctx, contest, viewer, participant)
	s.attachOneParticipantWinnerFlags(ctx, contest, participant)

	return participant, nil
}

func (s *TopPetService) ListParticipantsByContest(ctx context.Context, contestID model.ContestID, viewer *model.UserID, nominationFilter *model.ParticipantListNominationFilter, juryUnscoredOnly bool, participantScope string, submissionFilter string, votedByViewerOnly bool, limit, offset int32, sort string) ([]*model.Participant, int64, error) {
	if participantScope != model.ParticipantListScopeAll && participantScope != model.ParticipantListScopeMine {
		return nil, 0, fmt.Errorf("%w: invalid participant_scope", model.ErrBadRequest)
	}
	if participantScope == model.ParticipantListScopeMine && viewer == nil {
		return nil, 0, fmt.Errorf("%w: participant_scope=mine requires authentication", model.ErrBadRequest)
	}
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, 0, err
	}
	includeAll := false
	if viewer != nil {
		includeAll = s.userCanManageContest(ctx, contest, *viewer)
	}
	if votedByViewerOnly && viewer == nil {
		return nil, 0, fmt.Errorf("%w: voted_only requires authentication", model.ErrBadRequest)
	}
	if juryUnscoredOnly {
		if viewer == nil {
			return nil, 0, fmt.Errorf("%w: jury_unscored_only requires authentication", model.ErrBadRequest)
		}
		if !contest.JuryVotingEnabled {
			return nil, 0, model.ErrorForbidden
		}
		ok, jerr := s.repository.IsContestJuryMember(ctx, contestID, *viewer)
		if jerr != nil {
			return nil, 0, jerr
		}
		if !ok {
			return nil, 0, model.ErrorForbidden
		}
	}
	if nominationFilter != nil {
		if nominationFilter.UnassignedOnly && strings.TrimSpace(nominationFilter.NominationID) != "" {
			return nil, 0, model.ErrBadRequest
		}
		nid := strings.TrimSpace(nominationFilter.NominationID)
		if !nominationFilter.UnassignedOnly && nid != "" {
			if _, err := s.repository.GetNominationByContest(ctx, contestID, nid); err != nil {
				if errors.Is(err, model.ErrorNotFound) {
					return nil, 0, model.ErrorNotFound
				}
				return nil, 0, err
			}
		}
	}
	sf, sferr := normalizeParticipantListSubmissionFilter(includeAll, submissionFilter)
	if sferr != nil {
		return nil, 0, sferr
	}
	listOrder := strings.TrimSpace(strings.ToLower(sort))
	switch listOrder {
	case "":
		if contest.Status == model.ContestStatusVoting || contest.Status == model.ContestStatusFinished {
			listOrder = model.ParticipantListSortVotes
		} else {
			listOrder = model.ParticipantListSortCreatedAt
		}
	case model.ParticipantListSortVotes, model.ParticipantListSortJury, model.ParticipantListSortCreatedAt:
	default:
		return nil, 0, fmt.Errorf("%w: sort must be votes, jury or created_at", model.ErrBadRequest)
	}
	participants, total, err := s.repository.ListParticipantsByContest(ctx, contestID, viewer, includeAll, nominationFilter, juryUnscoredOnly, participantScope, sf, votedByViewerOnly, limit, offset, listOrder)
	if err != nil {
		return nil, 0, err
	}

	for _, p := range participants {
		photos, _ := s.repository.GetPhotosByParticipantID(ctx, p.ID)
		p.Photos = photos

		totalVotes, _ := s.repository.CountVotesByParticipant(ctx, p.ID)
		p.TotalVotes = totalVotes
	}

	s.attachParticipantJuryScoreTotals(ctx, contest, viewer, participants)
	s.attachParticipantWinnerFlags(ctx, contest, participants)

	return participants, total, nil
}

func (s *TopPetService) UpdateParticipant(ctx context.Context, participantID model.ParticipantID, userID model.UserID, entryTitle, entryDescription string, registrationAnswers *map[string]interface{}) (*model.Participant, error) {
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
		return nil, fmt.Errorf("%w: only participant owner can update", model.ErrForbidden)
	}

	resolvedName, err := s.resolveParticipantEntryTitle(ctx, userID, entryTitle)
	if err != nil {
		return nil, err
	}
	entryTitle = resolvedName

	// Get contest to check status
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] UpdateParticipant: ERROR - Failed to get contest: %v", err)
		return nil, err
	}
	log.Printf("[Service] UpdateParticipant: Contest found: status=%s", contest.Status)

	if contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] UpdateParticipant: ERROR - Contest status does not allow updates (status=%s)", contest.Status)
		return nil, fmt.Errorf("%w: can only update participation during registration", model.ErrBadRequest)
	}

	merged := cloneAnswersMap(participant.RegistrationAnswers)
	if registrationAnswers != nil {
		for k, v := range *registrationAnswers {
			merged[k] = v
		}
	}
	fields, err := s.repository.ListRegistrationFieldsByContest(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if err := ValidateRegistrationAnswers(fields, merged); err != nil {
		return nil, err
	}

	if err := s.ensureParticipantPhotoCountInBounds(ctx, participant); err != nil {
		return nil, err
	}

	log.Printf("[Service] UpdateParticipant: Updating participant in repository")
	updated, err := s.repository.UpdateParticipant(ctx, participantID, entryTitle, entryDescription, merged)
	if err != nil {
		log.Printf("[Service] UpdateParticipant: ERROR - Failed to update participant: %v", err)
		return nil, err
	}
	log.Printf("[Service] UpdateParticipant: Participant updated successfully: participantID=%s", updated.ID)

	photos, _ := s.repository.GetPhotosByParticipantID(ctx, updated.ID)
	updated.Photos = photos
	log.Printf("[Service] UpdateParticipant: Loaded %d photos for participant %s", len(photos), updated.ID)

	return updated, nil
}

func (s *TopPetService) AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, userID model.UserID, url string, thumbURL *string) (*model.Photo, error) {
	participant, err := s.repository.GetParticipant(ctx, participantID)
	if err != nil {
		return nil, err
	}

	// Only owner can add photos
	if participant.UserID != userID {
		return nil, fmt.Errorf("%w: only participant owner can add photos", model.ErrForbidden)
	}

	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		return nil, err
	}
	if contest.Status != model.ContestStatusRegistration {
		return nil, fmt.Errorf("%w: can only add photos during registration", model.ErrBadRequest)
	}

	_, maxN, err := s.photoCountBoundsForContestParticipant(ctx, participant.ContestID, participant.NominationID)
	if err != nil {
		return nil, err
	}
	existingPhotos, err := s.repository.GetPhotosByParticipantID(ctx, participantID)
	if err != nil {
		return nil, err
	}
	if int32(len(existingPhotos)) >= maxN {
		return nil, fmt.Errorf("%w: at most %d photos allowed (already have %d)", model.ErrBadRequest, maxN, len(existingPhotos))
	}

	photo, err := s.repository.AddParticipantPhoto(ctx, participantID, url, thumbURL)
	if err != nil {
		return nil, err
	}
	_ = s.repository.MarkParticipantSubmissionPending(ctx, participantID)
	return photo, nil
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
		return fmt.Errorf("%w: only participant owner can delete", model.ErrForbidden)
	}

	// Get contest to check status
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] DeleteParticipant: ERROR - Failed to get contest: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipant: Contest found: status=%s", contest.Status)

	if contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] DeleteParticipant: ERROR - Contest status does not allow deletion (status=%s)", contest.Status)
		return fmt.Errorf("%w: can only withdraw participation during registration", model.ErrBadRequest)
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
		return fmt.Errorf("%w: only participant owner can delete photos", model.ErrForbidden)
	}

	// Get contest to check status
	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] DeleteParticipantPhoto: ERROR - Failed to get contest: %v", err)
		return err
	}
	log.Printf("[Service] DeleteParticipantPhoto: Contest found: status=%s", contest.Status)

	if contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] DeleteParticipantPhoto: ERROR - Contest status does not allow photo deletion (status=%s)", contest.Status)
		return fmt.Errorf("%w: can only delete photos during registration", model.ErrBadRequest)
	}

	log.Printf("[Service] DeleteParticipantPhoto: Deleting photo in repository")
	err = s.repository.DeleteParticipantPhoto(ctx, participantID, photoID)
	if err != nil {
		log.Printf("[Service] DeleteParticipantPhoto: ERROR - Failed to delete photo: %v", err)
		return err
	}
	_ = s.repository.MarkParticipantSubmissionPending(ctx, participantID)
	log.Printf("[Service] DeleteParticipantPhoto: Photo deleted successfully: photoID=%s", photoID)

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
		return fmt.Errorf("%w: only participant owner can reorder photos", model.ErrForbidden)
	}

	contest, err := s.getContestForBusiness(ctx, participant.ContestID)
	if err != nil {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - Failed to get contest: %v", err)
		return err
	}

	if contest.Status != model.ContestStatusRegistration {
		log.Printf("[Service] UpdateParticipantPhotoOrder: ERROR - Contest status does not allow reordering (status=%s)", contest.Status)
		return fmt.Errorf("%w: can only reorder photos during registration", model.ErrBadRequest)
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
	_ = s.repository.MarkParticipantSubmissionPending(ctx, participantID)

	log.Printf("[Service] UpdateParticipantPhotoOrder: Order updated successfully")
	return nil
}
