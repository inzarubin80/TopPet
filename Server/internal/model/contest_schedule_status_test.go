package model

import (
	"testing"
	"time"
)

func TestExpectedContestStatusAt_noScheduleDates_keepsDBStatus(t *testing.T) {
	c := &Contest{
		Status: ContestStatusRegistration,
	}
	got := ExpectedContestStatusAt(c, time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC))
	if got != ContestStatusRegistration {
		t.Fatalf("expected DB status preserved, got %s", got)
	}
}

func TestExpectedContestStatusAt_withSchedule_ignoresStaleDBWhenAhead(t *testing.T) {
	reg := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	c := &Contest{
		Status:               ContestStatusDraft,
		RegistrationStartsAt: &reg,
	}
	got := ExpectedContestStatusAt(c, reg.Add(time.Minute))
	if got != ContestStatusRegistration {
		t.Fatalf("expected registration, got %s", got)
	}
}
