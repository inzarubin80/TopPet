package service

import (
	"context"
	"log"
	"time"

	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/model"
)

// RunContestStatusScheduler периодически переводит конкурсы по расписанию (UTC):
// draft → publication (publication_starts_at), draft|publication → registration (registration_starts_at),
// registration → voting (voting_starts_at), voting → finished (voting_ends_at).
func (s *TopPetService) RunContestStatusScheduler(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.tickContestStatuses(ctx)
		}
	}
}

func (s *TopPetService) tickContestStatuses(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[ContestScheduler] panic: %v", r)
		}
	}()

	dbCtx, cancel := appcontext.WithDatabaseTimeout(ctx)
	defer cancel()

	contests, err := s.repository.ListContestsForStatusAutomation(dbCtx)
	if err != nil {
		log.Printf("[ContestScheduler] list contests: %v", err)
		return
	}

	now := time.Now().UTC()
	for _, c := range contests {
		next, changed := computeAutoContestStatus(c, now)
		if !changed {
			continue
		}
		if _, err := s.repository.UpdateContestStatus(dbCtx, c.ID, next); err != nil {
			log.Printf("[ContestScheduler] contest %s -> %s: %v", c.ID, next, err)
			continue
		}
		log.Printf("[ContestScheduler] contest %s: %s -> %s", c.ID, c.Status, next)
		s.broadcastContestStatus(c.ID, next)
	}
}

func computeAutoContestStatus(c *model.Contest, now time.Time) (model.ContestStatus, bool) {
	orig := c.Status
	st := c.Status
	for {
		switch st {
		case model.ContestStatusDraft:
			if c.PublicationStartsAt != nil && !now.Before(*c.PublicationStartsAt) {
				st = model.ContestStatusPublication
				continue
			}
			if c.RegistrationStartsAt != nil && !now.Before(*c.RegistrationStartsAt) {
				st = model.ContestStatusRegistration
				continue
			}
			return st, st != orig
		case model.ContestStatusPublication:
			if c.RegistrationStartsAt != nil && !now.Before(*c.RegistrationStartsAt) {
				st = model.ContestStatusRegistration
				continue
			}
			return st, st != orig
		case model.ContestStatusRegistration:
			if c.VotingStartsAt != nil && !now.Before(*c.VotingStartsAt) {
				st = model.ContestStatusVoting
				continue
			}
			return st, st != orig
		case model.ContestStatusVoting:
			if c.VotingEndsAt != nil && !now.Before(*c.VotingEndsAt) {
				return model.ContestStatusFinished, true
			}
			return st, st != orig
		default:
			return st, st != orig
		}
	}
}
