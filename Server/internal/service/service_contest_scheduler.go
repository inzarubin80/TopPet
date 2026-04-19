package service

import (
	"context"
	"log"
	"time"

	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/model"
)

// RunContestStatusScheduler периодически выставляет статус конкурса по расписанию (UTC, моменты в БД).
// Ожидаемый статус (сверка «сейчас»): voting_ends_at → finished; voting_starts_at → voting;
// registration_starts_at → registration; publication_starts_at → publication; иначе → draft.
// Если фактический статус отличается — обновляется (в т.ч. откат при переносе дат в будущее).
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
		next, changed := reconcileContestStatusWithSchedule(c, now)
		if !changed {
			continue
		}
		if _, err := s.repository.UpdateContestStatus(dbCtx, c.ID, next); err != nil {
			log.Printf("[ContestScheduler] contest %s -> %s: %v", c.ID, next, err)
			continue
		}
		log.Printf("[ContestScheduler] contest %s: %s -> %s", c.ID, c.Status, next)
		s.broadcastContestStatus(c.ID, next)
		if next == model.ContestStatusFinished {
			if _, err := s.persistVotingResultsAfterFinished(dbCtx, c.ID); err != nil {
				log.Printf("[ContestScheduler] persist voting results contest %s: %v", c.ID, err)
			} else {
				// Второй broadcast после записи снимка — клиенты подтянут audience/jury winners без гонки с первым fetch.
				s.broadcastContestStatus(c.ID, model.ContestStatusFinished)
			}
		}
	}
}

func reconcileContestStatusWithSchedule(c *model.Contest, now time.Time) (model.ContestStatus, bool) {
	next := model.ExpectedContestStatusAt(c, now)
	return next, next != c.Status
}
