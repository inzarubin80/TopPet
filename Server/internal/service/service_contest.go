package service

import (
	"context"
	"errors"
	"fmt"
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

func validateContestScheduleTimes(regS, regE, votS, votE *time.Time) error {
	if regS != nil && regE != nil && !regS.Before(*regE) {
		return fmt.Errorf("registration_starts_at must be before registration_ends_at")
	}
	if regE != nil && votS != nil && votS.Before(*regE) {
		return fmt.Errorf("voting_starts_at must be on or after registration_ends_at")
	}
	if regE == nil && regS != nil && votS != nil && !regS.Before(*votS) {
		return fmt.Errorf("registration_starts_at must be before voting_starts_at when registration_ends_at is not set")
	}
	if votS != nil && votE != nil && !votS.Before(*votE) {
		return fmt.Errorf("voting_starts_at must be before voting_ends_at")
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

func (s *TopPetService) CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
	if title == "" {
		return nil, errors.New("title is required")
	}

	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	role, err := s.repository.GetUserRole(dbCtx, userID)
	if err != nil {
		return nil, err
	}
	if role != model.UserRoleSystemAdmin && role != model.UserRoleContestAdmin {
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

	return contests, total, nil
}

func (s *TopPetService) UpdateContest(ctx context.Context, contestID model.ContestID, userID model.UserID, u model.ContestUpdate) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, errors.New("only contest admin can update contest")
	}

	// Only draft can be updated
	if contest.Status != model.ContestStatusDraft {
		return nil, fmt.Errorf("contest must be in draft status to update, current status: %s", contest.Status)
	}

	if err := validateContestScheduleTimes(u.RegistrationStartsAt, u.RegistrationEndsAt, u.VotingStartsAt, u.VotingEndsAt); err != nil {
		return nil, fmt.Errorf("%w: %v", model.ErrBadRequest, err)
	}

	return s.repository.UpdateContest(ctx, contestID, u)
}

func contestToUpdate(c *model.Contest) model.ContestUpdate {
	return model.ContestUpdate{
		Title:                c.Title,
		Description:          c.Description,
		PublicVotingEnabled:  c.PublicVotingEnabled,
		JuryVotingEnabled:    c.JuryVotingEnabled,
		CoverUrl:             c.CoverUrl,
		Tagline:              c.Tagline,
		RulesUrl:             c.RulesUrl,
		PrizeText:            c.PrizeText,
		LogoUrl:              c.LogoUrl,
		ThemeColor:           c.ThemeColor,
		SponsorName:          c.SponsorName,
		SponsorLogoUrl:       c.SponsorLogoUrl,
		SponsorUrl:           c.SponsorUrl,
		CtaLabelOverride:     c.CtaLabelOverride,
		RegistrationStartsAt: timePtrClone(c.RegistrationStartsAt),
		RegistrationEndsAt:   timePtrClone(c.RegistrationEndsAt),
		VotingStartsAt:       timePtrClone(c.VotingStartsAt),
		VotingEndsAt:         timePtrClone(c.VotingEndsAt),
	}
}

// UploadContestAsset сохраняет URL загруженного изображения (черновик, только организатор).
func (s *TopPetService) UploadContestAsset(ctx context.Context, contestID model.ContestID, userID model.UserID, kind, assetURL string) (*model.Contest, error) {
	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	contest, err := s.repository.GetContest(dbCtx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, errors.New("only contest admin can update contest")
	}

	if contest.Status != model.ContestStatusDraft {
		return nil, fmt.Errorf("contest must be in draft status to update, current status: %s", contest.Status)
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
		return nil, fmt.Errorf("invalid asset kind: %s", kind)
	}

	updated, err := s.repository.UpdateContest(dbCtx, contestID, u)
	if err != nil {
		return nil, err
	}

	if totalVotes, err := s.repository.CountVotesByContest(dbCtx, contestID); err == nil {
		updated.TotalVotes = totalVotes
	}

	return updated, nil
}

func (s *TopPetService) PublishContest(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, errors.New("only contest admin can publish contest")
	}

	// Only draft can be opened for registration
	if contest.Status != model.ContestStatusDraft {
		return nil, fmt.Errorf("contest must be in draft status to publish, current status: %s", contest.Status)
	}

	return s.repository.UpdateContestStatus(ctx, contestID, model.ContestStatusRegistration)
}

func (s *TopPetService) FinishContest(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, errors.New("only contest admin can finish contest")
	}

	// Only voting can be finished
	if contest.Status != model.ContestStatusVoting {
		return nil, fmt.Errorf("contest must be in voting status to finish, current status: %s", contest.Status)
	}

	return s.repository.UpdateContestStatus(ctx, contestID, model.ContestStatusFinished)
}

func (s *TopPetService) UpdateContestStatus(ctx context.Context, contestID model.ContestID, userID model.UserID, status model.ContestStatus) (*model.Contest, error) {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return nil, errors.New("only contest admin can update contest status")
	}

	switch status {
	case model.ContestStatusDraft,
		model.ContestStatusRegistration,
		model.ContestStatusVoting,
		model.ContestStatusFinished:
	default:
		return nil, fmt.Errorf("invalid contest status %s", status)
	}

	updated, err := s.repository.UpdateContestStatus(ctx, contestID, status)
	if err != nil {
		return nil, err
	}

	s.broadcastContestStatus(contestID, status)

	return updated, nil
}

func (s *TopPetService) DeleteContest(ctx context.Context, contestID model.ContestID, userID model.UserID) error {
	contest, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return err
	}

	if !s.userCanManageContest(ctx, contest, userID) {
		return errors.New("only contest admin can delete contest")
	}

	return s.repository.DeleteContest(ctx, contestID)
}
