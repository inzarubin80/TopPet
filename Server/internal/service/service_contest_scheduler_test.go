package service

import (
	"testing"
	"time"

	"toppet/server/internal/model"
)

func TestComputeAutoContestStatus_publicationToRegistration(t *testing.T) {
	reg := time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:                 model.ContestStatusPublication,
		RegistrationStartsAt:   &reg,
	}
	next, changed := computeAutoContestStatus(c, reg.Add(time.Minute))
	if !changed || next != model.ContestStatusRegistration {
		t.Fatalf("expected registration, changed=true; got status=%s changed=%v", next, changed)
	}
}

func TestComputeAutoContestStatus_publicationUnchangedBeforeReg(t *testing.T) {
	reg := time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:                 model.ContestStatusPublication,
		RegistrationStartsAt:   &reg,
	}
	next, changed := computeAutoContestStatus(c, reg.Add(-time.Minute))
	if changed || next != model.ContestStatusPublication {
		t.Fatalf("expected unchanged publication; got status=%s changed=%v", next, changed)
	}
}

func TestComputeAutoContestStatus_draftToRegistrationStillWorks(t *testing.T) {
	reg := time.Date(2026, 2, 1, 8, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:                 model.ContestStatusDraft,
		RegistrationStartsAt:   &reg,
	}
	next, changed := computeAutoContestStatus(c, reg)
	if !changed || next != model.ContestStatusRegistration {
		t.Fatalf("expected registration, changed=true; got status=%s changed=%v", next, changed)
	}
}

func TestComputeAutoContestStatus_draftToPublicationBySchedule(t *testing.T) {
	pub := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	reg := time.Date(2026, 3, 5, 10, 0, 0, 0, time.UTC)
	c := &model.Contest{
		Status:                 model.ContestStatusDraft,
		PublicationStartsAt:    &pub,
		RegistrationStartsAt:   &reg,
	}
	next, changed := computeAutoContestStatus(c, pub.Add(time.Minute))
	if !changed || next != model.ContestStatusPublication {
		t.Fatalf("expected publication, changed=true; got status=%s changed=%v", next, changed)
	}
}

func TestComputeAutoContestStatus_draftPublicationThenRegistrationSameTick(t *testing.T) {
	pub := time.Date(2026, 4, 1, 9, 0, 0, 0, time.UTC)
	reg := time.Date(2026, 4, 1, 11, 0, 0, 0, time.UTC)
	now := reg.Add(time.Minute)
	c := &model.Contest{
		Status:                 model.ContestStatusDraft,
		PublicationStartsAt:    &pub,
		RegistrationStartsAt:   &reg,
	}
	next, changed := computeAutoContestStatus(c, now)
	if !changed || next != model.ContestStatusRegistration {
		t.Fatalf("expected registration after chained transitions; got status=%s changed=%v", next, changed)
	}
}
