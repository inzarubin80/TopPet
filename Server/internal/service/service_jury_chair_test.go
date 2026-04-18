package service

import (
	"testing"

	"toppet/server/internal/model"
)

func TestMergeJuryChairWinnersFromPartialPut_keepsOtherNominations(t *testing.T) {
	pidA := model.ParticipantID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	pidB := model.ParticipantID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	existing := []model.ContestWinnerBrief{
		{ParticipantID: pidA, Place: 1, PetName: "a"},
	}
	assignments := []model.JuryChairAssignmentInput{
		{ParticipantID: pidB, Place: ptrInt(2)},
	}
	fromBody := []model.ContestWinnerBrief{
		{ParticipantID: pidB, Place: 2, PetName: "b"},
	}
	got := mergeJuryChairWinnersFromPartialPut(existing, assignments, fromBody)
	if len(got) != 2 {
		t.Fatalf("len=%d want 2", len(got))
	}
	byID := map[model.ParticipantID]int{}
	for _, w := range got {
		byID[w.ParticipantID] = w.Place
	}
	if byID[pidA] != 1 || byID[pidB] != 2 {
		t.Fatalf("places: %+v", byID)
	}
}

func TestMergeJuryChairWinnersFromPartialPut_clearsWhenBodyHasNoPlace(t *testing.T) {
	pidA := model.ParticipantID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	existing := []model.ContestWinnerBrief{
		{ParticipantID: pidA, Place: 1, PetName: "a"},
	}
	assignments := []model.JuryChairAssignmentInput{
		{ParticipantID: pidA},
	}
	got := mergeJuryChairWinnersFromPartialPut(existing, assignments, nil)
	if len(got) != 0 {
		t.Fatalf("len=%d want 0 (cleared)", len(got))
	}
}

func TestMergeJuryChairWinnersFromPartialPut_replacesInPlace(t *testing.T) {
	pidA := model.ParticipantID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	existing := []model.ContestWinnerBrief{
		{ParticipantID: pidA, Place: 1, PetName: "old"},
	}
	assignments := []model.JuryChairAssignmentInput{
		{ParticipantID: pidA, Place: ptrInt(3)},
	}
	fromBody := []model.ContestWinnerBrief{
		{ParticipantID: pidA, Place: 3, PetName: "new"},
	}
	got := mergeJuryChairWinnersFromPartialPut(existing, assignments, fromBody)
	if len(got) != 1 || got[0].Place != 3 || got[0].PetName != "new" {
		t.Fatalf("got %+v", got)
	}
}

func ptrInt(n int) *int {
	return &n
}
