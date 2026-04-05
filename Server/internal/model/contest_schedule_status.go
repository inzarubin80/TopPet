package model

import "time"

func contestHasAnyScheduleDate(c *Contest) bool {
	return c.PublicationStartsAt != nil ||
		c.RegistrationStartsAt != nil ||
		c.VotingStartsAt != nil ||
		c.VotingEndsAt != nil
}

// ExpectedContestStatusAt возвращает статус по датам фаз (now в UTC).
// Если ни одной даты расписания нет — возвращается текущий c.Status (из БД), чтобы не ломать конкурсы без расписания.
func ExpectedContestStatusAt(c *Contest, now time.Time) ContestStatus {
	if !contestHasAnyScheduleDate(c) {
		return c.Status
	}
	if c.VotingEndsAt != nil && !now.Before(*c.VotingEndsAt) {
		return ContestStatusFinished
	}
	if c.VotingStartsAt != nil && !now.Before(*c.VotingStartsAt) {
		return ContestStatusVoting
	}
	if c.RegistrationStartsAt != nil && !now.Before(*c.RegistrationStartsAt) {
		return ContestStatusRegistration
	}
	if c.PublicationStartsAt != nil && !now.Before(*c.PublicationStartsAt) {
		return ContestStatusPublication
	}
	return ContestStatusDraft
}

// ApplyEffectiveContestStatus подменяет c.Status на расчётный по расписанию (для API и бизнес-проверок).
func ApplyEffectiveContestStatus(c *Contest, now time.Time) {
	c.Status = ExpectedContestStatusAt(c, now)
}
