package service

import (
	"testing"

	"toppet/server/internal/model"
)

func TestNormalizeParticipantListSubmissionFilter_nonManagerAcceptedPreserved(t *testing.T) {
	got, err := normalizeParticipantListSubmissionFilter(false, "accepted")
	if err != nil {
		t.Fatal(err)
	}
	if got != model.ParticipantListSubmissionAccepted {
		t.Fatalf("got %q, want %q", got, model.ParticipantListSubmissionAccepted)
	}
}

func TestNormalizeParticipantListSubmissionFilter_nonManagerOtherStillAll(t *testing.T) {
	for _, raw := range []string{"", "all", "pending", "rejected", "non_accepted"} {
		got, err := normalizeParticipantListSubmissionFilter(false, raw)
		if err != nil {
			t.Fatalf("raw %q: %v", raw, err)
		}
		if got != model.ParticipantListSubmissionAll {
			t.Fatalf("raw %q: got %q, want all", raw, got)
		}
	}
}

func TestNormalizeParticipantListSubmissionFilter_managerCanUseRichFilters(t *testing.T) {
	got, err := normalizeParticipantListSubmissionFilter(true, "pending")
	if err != nil {
		t.Fatal(err)
	}
	if got != model.ParticipantListSubmissionPending {
		t.Fatalf("got %q, want pending", got)
	}
}
