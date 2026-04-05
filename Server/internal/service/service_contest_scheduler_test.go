package service

import (
	"testing"
	"time"

	"toppet/server/internal/model"
)

func TestExpectedContestStatus_publicationToRegistration(t *testing.T) {
	reg := time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC)
	pub := time.Date(2026, 1, 5, 12, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:               model.ContestStatusPublication,
		PublicationStartsAt:  &pub,
		RegistrationStartsAt: &reg,
	}
	next, changed := reconcileContestStatusWithSchedule(c, reg.Add(time.Minute))
	if !changed || next != model.ContestStatusRegistration {
		t.Fatalf("expected registration, changed=true; got status=%s changed=%v", next, changed)
	}
}

func TestExpectedContestStatus_publicationUnchangedBeforeReg(t *testing.T) {
	reg := time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC)
	pub := time.Date(2026, 1, 5, 12, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:               model.ContestStatusPublication,
		PublicationStartsAt:  &pub,
		RegistrationStartsAt: &reg,
	}
	next, changed := reconcileContestStatusWithSchedule(c, reg.Add(-time.Minute))
	if changed || next != model.ContestStatusPublication {
		t.Fatalf("expected unchanged publication; got status=%s changed=%v", next, changed)
	}
}

func TestExpectedContestStatus_draftToRegistrationWithoutPublicationDate(t *testing.T) {
	reg := time.Date(2026, 2, 1, 8, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:               model.ContestStatusDraft,
		RegistrationStartsAt: &reg,
	}
	next, changed := reconcileContestStatusWithSchedule(c, reg)
	if !changed || next != model.ContestStatusRegistration {
		t.Fatalf("expected registration, changed=true; got status=%s changed=%v", next, changed)
	}
}

func TestExpectedContestStatus_draftToPublicationBySchedule(t *testing.T) {
	pub := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	reg := time.Date(2026, 3, 5, 10, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:               model.ContestStatusDraft,
		PublicationStartsAt:  &pub,
		RegistrationStartsAt: &reg,
	}
	next, changed := reconcileContestStatusWithSchedule(c, pub.Add(time.Minute))
	if !changed || next != model.ContestStatusPublication {
		t.Fatalf("expected publication, changed=true; got status=%s changed=%v", next, changed)
	}
}

func TestExpectedContestStatus_registrationWhenPubAndRegPassed(t *testing.T) {
	pub := time.Date(2026, 4, 1, 9, 0, 0, 0, time.UTC)
	reg := time.Date(2026, 4, 1, 11, 0, 0, 0, time.UTC)
	now := reg.Add(time.Minute)
	c := &model.Contest{
		Status:               model.ContestStatusDraft,
		PublicationStartsAt:  &pub,
		RegistrationStartsAt: &reg,
	}
	next, changed := reconcileContestStatusWithSchedule(c, now)
	if !changed || next != model.ContestStatusRegistration {
		t.Fatalf("expected registration; got status=%s changed=%v", next, changed)
	}
}

func TestExpectedContestStatus_rollBackToDraftWhenAllDatesFuture(t *testing.T) {
	future := time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:               model.ContestStatusRegistration,
		PublicationStartsAt:  &future,
		RegistrationStartsAt: &future,
		VotingStartsAt:       &future,
		VotingEndsAt:         &future,
	}
	next, changed := reconcileContestStatusWithSchedule(c, time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC))
	if !changed || next != model.ContestStatusDraft {
		t.Fatalf("expected draft rollback; got status=%s changed=%v", next, changed)
	}
}

func TestExpectedContestStatus_finishedWhenVotingEnded(t *testing.T) {
	votS := time.Date(2026, 5, 1, 8, 0, 0, 0, time.UTC)
	votE := time.Date(2026, 5, 10, 20, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:         model.ContestStatusVoting,
		VotingStartsAt: &votS,
		VotingEndsAt:   &votE,
	}
	next, changed := reconcileContestStatusWithSchedule(c, votE.Add(time.Minute))
	if !changed || next != model.ContestStatusFinished {
		t.Fatalf("expected finished; got status=%s changed=%v", next, changed)
	}
}

func TestExpectedContestStatus_votingWhenStartedBeforeEnd(t *testing.T) {
	reg := time.Date(2026, 5, 1, 6, 0, 0, 0, time.UTC)
	votS := time.Date(2026, 5, 5, 8, 0, 0, 0, time.UTC)
	votE := time.Date(2026, 5, 20, 20, 0, 0, 0, time.UTC)
	now := time.Date(2026, 5, 12, 12, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:               model.ContestStatusRegistration,
		RegistrationStartsAt: &reg,
		VotingStartsAt:       &votS,
		VotingEndsAt:         &votE,
	}
	next, changed := reconcileContestStatusWithSchedule(c, now)
	if !changed || next != model.ContestStatusVoting {
		t.Fatalf("expected voting; got status=%s changed=%v", next, changed)
	}
}
