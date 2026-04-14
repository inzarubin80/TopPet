package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	appcontext "toppet/server/internal/app/context"
	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

func timePtrClone(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	tt := *t
	return &tt
}

const defaultContestScheduleTimezone = "Europe/Moscow"

func normalizeContestScheduleTimezone(s string) string {
	t := strings.TrimSpace(s)
	if t == "" {
		return defaultContestScheduleTimezone
	}
	return t
}

func validateContestScheduleTimes(pubS, regS, votS, votE *time.Time) error {
	if pubS != nil && regS != nil && !pubS.Before(*regS) {
		return fmt.Errorf("publication_starts_at must be before registration_starts_at")
	}
	if regS != nil && votS != nil && !regS.Before(*votS) {
		return fmt.Errorf("registration_starts_at must be before voting_starts_at")
	}
	if votS != nil && votE != nil && !votS.Before(*votE) {
		return fmt.Errorf("voting_starts_at must be before voting_ends_at")
	}
	return nil
}

func validateContestPhotoCounts(minC, maxC int) error {
	if minC < 1 || minC > 30 || maxC < 1 || maxC > 30 {
		return fmt.Errorf("%w: min_photo_count and max_photo_count must be between 1 and 30", model.ErrBadRequest)
	}
	if minC > maxC {
		return fmt.Errorf("%w: min_photo_count must be <= max_photo_count", model.ErrBadRequest)
	}
	return nil
}

func (s *TopPetService) broadcastContestStatus(contestID model.ContestID, status model.ContestStatus) {
	if s.hub == nil {
		return
	}
	payload := wsapp.NewContestStatusUpdatedPayload(contestID, string(status))
	_ = s.hub.BroadcastContestMessage(contestID, payload)
}

// getContestForBusiness загружает конкурс и подставляет расчётный статус по расписанию (проверки и ответы API).
func (s *TopPetService) getContestForBusiness(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	c, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	model.ApplyEffectiveContestStatus(c, time.Now().UTC())
	return c, nil
}

func (s *TopPetService) CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
	if title == "" {
		return nil, fmt.Errorf("%w: title is required", model.ErrBadRequest)
	}

	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	role, err := s.repository.GetUserRole(dbCtx, userID)
	if err != nil {
		return nil, err
	}
	if !model.IsGlobalContestManagerRole(role) {
		return nil, model.ErrorForbidden
	}

	contest, err := s.repository.CreateContest(dbCtx, userID, title, description)
	if err != nil {
		return nil, err
	}

	return contest, nil
}

func (s *TopPetService) GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	contest, err := s.repository.GetContest(dbCtx, contestID)
	if err != nil {
		return nil, err
	}

	// Add total votes count
	totalVotes, err := s.repository.CountVotesByContest(dbCtx, contestID)
	if err == nil {
		contest.TotalVotes = totalVotes
	}

	model.ApplyEffectiveContestStatus(contest, time.Now().UTC())
	s.enrichContestWithWinners(dbCtx, contest)
	return contest, nil
}

func (s *TopPetService) ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	contests, total, err := s.repository.ListContests(dbCtx, status, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	// Optimize: get all vote counts in one query instead of N+1
	if len(contests) > 0 {
		contestIDs := make([]model.ContestID, len(contests))
		for i, contest := range contests {
			contestIDs[i] = contest.ID
		}

		voteCounts, err := s.repository.CountVotesByContests(dbCtx, contestIDs)
		if err == nil {
			// Set vote counts from the batch query result
			for _, contest := range contests {
				if count, ok := voteCounts[contest.ID]; ok {
					contest.TotalVotes = count
				}
			}
		} else {
			// Fallback to individual queries if batch fails
			for _, contest := range contests {
				totalVotes, err := s.repository.CountVotesByContest(dbCtx, contest.ID)
				if err == nil {
					contest.TotalVotes = totalVotes
				}
			}
		}
	}

	now := time.Now().UTC()
	for _, c := range contests {
		model.ApplyEffectiveContestStatus(c, now)
	}

	s.enrichContestsWithWinners(dbCtx, contests)

	return contests, total, nil
}

func (s *TopPetService) UpdateContest(ctx context.Context, contestID model.ContestID, userID model.UserID, u model.ContestUpdate) (*model.Contest, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, fmt.Errorf("%w: only contest admin can update contest", model.ErrForbidden)
	}

	if err := validateContestScheduleTimes(u.PublicationStartsAt, u.RegistrationStartsAt, u.VotingStartsAt, u.VotingEndsAt); err != nil {
		return nil, fmt.Errorf("%w: %v", model.ErrBadRequest, err)
	}
	tz := normalizeContestScheduleTimezone(u.ScheduleTimezone)
	if _, err := time.LoadLocation(tz); err != nil {
		return nil, fmt.Errorf("%w: schedule_timezone: %v", model.ErrBadRequest, err)
	}
	u.ScheduleTimezone = tz

	if err := validateContestPhotoCounts(u.MinPhotoCount, u.MaxPhotoCount); err != nil {
		return nil, err
	}

	updated, err := s.repository.UpdateContest(ctx, contestID, u)
	if err != nil {
		return nil, err
	}
	if err := s.repository.SyncNominationPhotoCountsByContest(ctx, contestID, int32(updated.MinPhotoCount), int32(updated.MaxPhotoCount)); err != nil {
		return nil, err
	}
	model.ApplyEffectiveContestStatus(updated, time.Now().UTC())
	return updated, nil
}

func contestToUpdate(c *model.Contest) model.ContestUpdate {
	return model.ContestUpdate{
		Title:                          c.Title,
		Description:                    c.Description,
		PublicVotingEnabled:            c.PublicVotingEnabled,
		JuryVotingEnabled:              c.JuryVotingEnabled,
		CoverUrl:                       c.CoverUrl,
		Tagline:                        c.Tagline,
		RulesText:                      c.RulesText,
		PrizeText:                      c.PrizeText,
		LogoUrl:                        c.LogoUrl,
		ThemeColor:                     c.ThemeColor,
		SponsorName:                    c.SponsorName,
		SponsorLogoUrl:                 c.SponsorLogoUrl,
		SponsorUrl:                     c.SponsorUrl,
		CtaLabelOverride:               c.CtaLabelOverride,
		ParticipantAllowedEmailDomains: model.JoinParticipantEmailDomainsDB(c.ParticipantAllowedEmailDomains),
		PublicationStartsAt:            timePtrClone(c.PublicationStartsAt),
		RegistrationStartsAt:           timePtrClone(c.RegistrationStartsAt),
		VotingStartsAt:                 timePtrClone(c.VotingStartsAt),
		VotingEndsAt:                   timePtrClone(c.VotingEndsAt),
		ScheduleTimezone:               normalizeContestScheduleTimezone(c.ScheduleTimezone),
		MinPhotoCount:                  c.MinPhotoCount,
		MaxPhotoCount:                  c.MaxPhotoCount,
		EntryTitleHint:                 c.EntryTitleHint,
	}
}

// UploadContestAsset сохраняет URL загруженного изображения (только организатор; статус конкурса любой).
func (s *TopPetService) UploadContestAsset(ctx context.Context, contestID model.ContestID, userID model.UserID, kind, assetURL string) (*model.Contest, error) {
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	contest, err := s.getContestForBusiness(dbCtx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, fmt.Errorf("%w: only contest admin can upload contest assets", model.ErrForbidden)
	}

	u := contestToUpdate(contest)
	switch kind {
	case "cover":
		u.CoverUrl = assetURL
	case "logo":
		u.LogoUrl = assetURL
	case "sponsor_logo":
		u.SponsorLogoUrl = assetURL
	default:
		return nil, fmt.Errorf("%w: invalid asset kind: %s", model.ErrBadRequest, kind)
	}

	updated, err := s.repository.UpdateContest(dbCtx, contestID, u)
	if err != nil {
		return nil, err
	}

	if totalVotes, err := s.repository.CountVotesByContest(dbCtx, contestID); err == nil {
		updated.TotalVotes = totalVotes
	}

	model.ApplyEffectiveContestStatus(updated, time.Now().UTC())
	return updated, nil
}

func (s *TopPetService) PublishContest(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Contest, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, fmt.Errorf("%w: only contest admin can publish contest", model.ErrForbidden)
	}

	// Only draft can be opened for registration
	if contest.Status != model.ContestStatusDraft {
		return nil, fmt.Errorf("%w: contest must be in draft status to publish, current status: %s", model.ErrBadRequest, contest.Status)
	}

	updated, err := s.repository.UpdateContestStatus(ctx, contestID, model.ContestStatusPublication)
	if err != nil {
		return nil, err
	}
	s.broadcastContestStatus(contestID, model.ContestStatusPublication)
	model.ApplyEffectiveContestStatus(updated, time.Now().UTC())
	return updated, nil
}

func (s *TopPetService) FinishContest(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Contest, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, fmt.Errorf("%w: only contest admin can finish contest", model.ErrForbidden)
	}

	// Only voting can be finished
	if contest.Status != model.ContestStatusVoting {
		return nil, fmt.Errorf("%w: contest must be in voting status to finish, current status: %s", model.ErrBadRequest, contest.Status)
	}

	updated, err := s.repository.UpdateContestStatus(ctx, contestID, model.ContestStatusFinished)
	if err != nil {
		return nil, err
	}
	s.broadcastContestStatus(contestID, model.ContestStatusFinished)
	model.ApplyEffectiveContestStatus(updated, time.Now().UTC())
	return updated, nil
}

func (s *TopPetService) UpdateContestStatus(ctx context.Context, contestID model.ContestID, userID model.UserID, status model.ContestStatus) (*model.Contest, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, fmt.Errorf("%w: only contest admin can update contest status", model.ErrForbidden)
	}

	switch status {
	case model.ContestStatusDraft,
		model.ContestStatusPublication,
		model.ContestStatusRegistration,
		model.ContestStatusVoting,
		model.ContestStatusFinished:
	default:
		return nil, fmt.Errorf("%w: invalid contest status %s", model.ErrBadRequest, status)
	}

	updated, err := s.repository.UpdateContestStatus(ctx, contestID, status)
	if err != nil {
		return nil, err
	}

	s.broadcastContestStatus(contestID, status)

	model.ApplyEffectiveContestStatus(updated, time.Now().UTC())
	return updated, nil
}

func (s *TopPetService) DeleteContest(ctx context.Context, contestID model.ContestID, userID model.UserID) error {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return fmt.Errorf("%w: only contest admin can delete contest", model.ErrForbidden)
	}

	return s.repository.DeleteContest(ctx, contestID)
}
