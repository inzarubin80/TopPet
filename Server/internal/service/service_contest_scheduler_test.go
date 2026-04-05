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
