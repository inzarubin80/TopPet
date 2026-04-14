package service

import (
	"testing"

	"toppet/server/internal/model"
)

func strPtr(s string) *string { return &s }

func TestComputeContestWinnerOutcome_notFinished(t *testing.T) {
	c := &model.Contest{
		Status: model.ContestStatusVoting, PublicVotingEnabled: true, JuryVotingEnabled: true,
		AudiencePrizePlaces: []model.ContestPrizePlace{{Place: 1, Prize: "A"}},
		JuryPrizePlaces:     []model.ContestPrizePlace{{Place: 1, Prize: "J"}},
	}
	rows := []model.ParticipantScoreForWinners{{ParticipantID: "p1", VoteCount: 5, JurySum: 10}}
	o := computeContestWinnerOutcome(c, rows, nil, nil)
	if len(o.audience) != 0 || len(o.jury) != 0 {
		t.Fatalf("expected no winners for non-finished")
	}
}

func TestComputeContestWinnerOutcome_singleBucket_audienceTie(t *testing.T) {
	c := &model.Contest{
		Status: model.ContestStatusFinished, PublicVotingEnabled: true, JuryVotingEnabled: false,
		AudiencePrizePlaces: []model.ContestPrizePlace{{Place: 1, Prize: "1000"}},
	}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "a", PetName: "A", VoteCount: 3, JurySum: 0},
		{ParticipantID: "b", PetName: "B", VoteCount: 3, JurySum: 0},
		{ParticipantID: "c", PetName: "C", VoteCount: 1, JurySum: 0},
	}
	o := computeContestWinnerOutcome(c, rows, nil, nil)
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
	c := &model.Contest{
		Status: model.ContestStatusFinished, PublicVotingEnabled: true, JuryVotingEnabled: true,
		AudiencePrizePlaces: []model.ContestPrizePlace{{Place: 1, Prize: "A"}},
		JuryPrizePlaces:     []model.ContestPrizePlace{{Place: 1, Prize: "J"}},
	}
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
	o := computeContestWinnerOutcome(c, rows, title, nil)
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
	c := &model.Contest{
		Status: model.ContestStatusFinished, PublicVotingEnabled: false, JuryVotingEnabled: true,
		JuryPrizePlaces: []model.ContestPrizePlace{{Place: 1, Prize: "J"}},
	}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "a", PetName: "A", VoteCount: 9, JurySum: 3},
	}
	o := computeContestWinnerOutcome(c, rows, nil, nil)
	if len(o.audience) != 0 {
		t.Fatalf("public off: no audience winners")
	}
	if len(o.jury) != 1 || o.jury[0].ParticipantID != "a" {
		t.Fatalf("jury winner expected a, got %+v", o.jury)
	}
}

func TestComputeContestWinnerOutcome_juryDenseRank_tieThenThirdPlace(t *testing.T) {
	// После ничьей на 2-м уровне баллов третья ступень (81) получает именно 3-е место, а не «4-е» как при спортивном ранге.
	n1 := "11111111-1111-1111-1111-111111111111"
	c := &model.Contest{
		Status: model.ContestStatusFinished, PublicVotingEnabled: false, JuryVotingEnabled: true,
		JuryPrizePlaces: []model.ContestPrizePlace{
			{Place: 1, Prize: "P1"},
			{Place: 2, Prize: "P2"},
			{Place: 3, Prize: "P3"},
		},
	}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "top", PetName: "Top", NominationID: strPtr(n1), JurySum: 105},
		{ParticipantID: "a", PetName: "A", NominationID: strPtr(n1), JurySum: 90},
		{ParticipantID: "b", PetName: "B", NominationID: strPtr(n1), JurySum: 90},
		{ParticipantID: "c", PetName: "C", NominationID: strPtr(n1), JurySum: 81},
	}
	o := computeContestWinnerOutcome(c, rows, func(nid *string) string {
		if nid != nil && *nid == n1 {
			return "Nom1"
		}
		return ""
	}, nil)
	if len(o.jury) != 4 {
		t.Fatalf("want 4 jury winners (1 + 2 tie + 1 third tier), got %d: %+v", len(o.jury), o.jury)
	}
	placeByID := map[model.ParticipantID]int{}
	for _, w := range o.jury {
		placeByID[w.ParticipantID] = w.Place
	}
	if placeByID["top"] != 1 || placeByID["a"] != 2 || placeByID["b"] != 2 || placeByID["c"] != 3 {
		t.Fatalf("dense places: %+v", placeByID)
	}
}

func TestComputeContestWinnerOutcome_zeroMax_noWinners(t *testing.T) {
	c := &model.Contest{
		Status: model.ContestStatusFinished, PublicVotingEnabled: true, JuryVotingEnabled: true,
		AudiencePrizePlaces: []model.ContestPrizePlace{{Place: 1, Prize: "A"}},
		JuryPrizePlaces:     []model.ContestPrizePlace{{Place: 1, Prize: "J"}},
	}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "a", PetName: "A", VoteCount: 0, JurySum: 0},
	}
	o := computeContestWinnerOutcome(c, rows, nil, nil)
	if len(o.audience) != 0 || len(o.jury) != 0 {
		t.Fatalf("max 0 means no winners in category")
	}
}

func TestComputeContestWinnerOutcome_nominationBucketOrderBySortOrder(t *testing.T) {
	n1 := "11111111-1111-1111-1111-111111111111"
	n2 := "22222222-2222-2222-2222-222222222222"
	c := &model.Contest{
		Status: model.ContestStatusFinished, PublicVotingEnabled: true, JuryVotingEnabled: false,
		AudiencePrizePlaces: []model.ContestPrizePlace{{Place: 1, Prize: "A"}},
	}
	rows := []model.ParticipantScoreForWinners{
		{ParticipantID: "p1", PetName: "One", NominationID: strPtr(n1), VoteCount: 5, JurySum: 0},
		{ParticipantID: "p3", PetName: "Three", NominationID: strPtr(n2), VoteCount: 7, JurySum: 0},
	}
	title := func(nid *string) string {
		if nid == nil {
			return ""
		}
		if *nid == n1 {
			return "First title"
		}
		return "Second title"
	}
	// UUID order: n1 < n2; sort_order: n2 first (0), n1 second (1)
	sortOrder := map[string]int{n1: 1, n2: 0}
	o := computeContestWinnerOutcome(c, rows, title, sortOrder)
	if len(o.audience) != 2 {
		t.Fatalf("want 2 audience winners, got %d", len(o.audience))
	}
	// Bucket n2 (sort 0) must appear before n1 (sort 1)
	if o.audience[0].ParticipantID != "p3" || o.audience[1].ParticipantID != "p1" {
		t.Fatalf("expected order p3 (n2) then p1 (n1), got %+v", o.audience)
	}
}
