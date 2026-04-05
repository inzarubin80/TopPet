package service

import (
	"testing"

	"toppet/server/internal/model"
)

func strPtr(s string) *string { return &s }

func TestComputeContestWinnerOutcome_notFinished(t *testing.T) {
	c := &model.Contest{Status: model.ContestStatusVoting, PublicVotingEnabled: true, JuryVotingEnabled: true}
	rows := []model.ParticipantScoreForWinners{{ParticipantID: "p1", VoteCount: 5, JurySum: 10}}
	o := computeContestWinnerOutcome(c, rows, nil)
	if len(o.audience) != 0 || len(o.jury) != 0 {
		t.Fatalf("expected no winners for non-finished")
	}
}

func TestComputeContestWinnerOutcome_singleBucket_audienceTie(t *testing.T) {
	c := &model.Contest{Status: model.ContestStatusFinished, PublicVotingEnabled: true, JuryVotingEnabled: false}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "a", PetName: "A", VoteCount: 3, JurySum: 0},
		{ParticipantID: "b", PetName: "B", VoteCount: 3, JurySum: 0},
		{ParticipantID: "c", PetName: "C", VoteCount: 1, JurySum: 0},
	}
	o := computeContestWinnerOutcome(c, rows, nil)
	if len(o.audience) != 2 {
		t.Fatalf("audience winners want 2 (tie), got %d", len(o.audience))
	}
	if len(o.jury) != 0 {
		t.Fatalf("jury disabled: want 0 jury entries")
	}
	_, okA := o.audienceSet["a"]
	_, okB := o.audienceSet["b"]
	if !okA || !okB {
		t.Fatalf("audienceSet missing tie winners")
	}
}

func TestComputeContestWinnerOutcome_nominationBuckets(t *testing.T) {
	n1 := "11111111-1111-1111-1111-111111111111"
	n2 := "22222222-2222-2222-2222-222222222222"
	c := &model.Contest{Status: model.ContestStatusFinished, PublicVotingEnabled: true, JuryVotingEnabled: true}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "p1", PetName: "One", NominationID: strPtr(n1), VoteCount: 5, JurySum: 10},
		{ParticipantID: "p2", PetName: "Two", NominationID: strPtr(n1), VoteCount: 2, JurySum: 20},
		{ParticipantID: "p3", PetName: "Three", NominationID: strPtr(n2), VoteCount: 7, JurySum: 5},
		{ParticipantID: "p4", PetName: "Four", NominationID: strPtr(n2), VoteCount: 1, JurySum: 15},
	}
	title := func(nid *string) string {
		if nid == nil {
			return ""
		}
		if *nid == n1 {
			return "Cats"
		}
		return "Dogs"
	}
	o := computeContestWinnerOutcome(c, rows, title)
	if len(o.audience) != 2 || len(o.jury) != 2 {
		t.Fatalf("want 2 audience + 2 jury (one per bucket), got aud=%d jury=%d", len(o.audience), len(o.jury))
	}
	// audience: p1 in n1, p3 in n2
	// jury: p2 in n1 (20), p4 in n2 (15)
	found := map[string]bool{}
	for _, w := range o.audience {
		found[string(w.ParticipantID)] = true
		if w.Score != 5 && w.Score != 7 {
			t.Fatalf("unexpected audience score %d for %s", w.Score, w.ParticipantID)
		}
	}
	if !found["p1"] || !found["p3"] {
		t.Fatalf("audience winners: %+v", o.audience)
	}
}

func TestComputeContestWinnerOutcome_publicDisabled_noAudience(t *testing.T) {
	c := &model.Contest{Status: model.ContestStatusFinished, PublicVotingEnabled: false, JuryVotingEnabled: true}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "a", PetName: "A", VoteCount: 9, JurySum: 3},
	}
	o := computeContestWinnerOutcome(c, rows, nil)
	if len(o.audience) != 0 {
		t.Fatalf("public off: no audience winners")
	}
	if len(o.jury) != 1 || o.jury[0].ParticipantID != "a" {
		t.Fatalf("jury winner expected a, got %+v", o.jury)
	}
}

func TestComputeContestWinnerOutcome_zeroMax_noWinners(t *testing.T) {
	c := &model.Contest{Status: model.ContestStatusFinished, PublicVotingEnabled: true, JuryVotingEnabled: true}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "a", PetName: "A", VoteCount: 0, JurySum: 0},
	}
	o := computeContestWinnerOutcome(c, rows, nil)
	if len(o.audience) != 0 || len(o.jury) != 0 {
		t.Fatalf("max 0 means no winners in category")
	}
}
