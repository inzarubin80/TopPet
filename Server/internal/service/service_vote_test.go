package service

import (
	"context"
	"testing"

	"toppet/server/internal/model"
)

func TestVoteNominationSlotFromParticipant(t *testing.T) {
	t.Parallel()
	nom := "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	cases := []struct {
		name string
		p    *model.Participant
		want *string
	}{
		{"nil participant", nil, nil},
		{"nil nomination", &model.Participant{NominationID: nil}, nil},
		{"empty nomination", &model.Participant{NominationID: strPtr("")}, nil},
		{"whitespace nomination", &model.Participant{NominationID: strPtr("  \t ")}, nil},
		{"valid nomination", &model.Participant{NominationID: &nom}, &nom},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := voteNominationSlotFromParticipant(tc.p)
			if (got == nil) != (tc.want == nil) {
				t.Fatalf("got %v want %v", got, tc.want)
			}
			if got != nil && tc.want != nil && *got != *tc.want {
				t.Fatalf("got %q want %q", *got, *tc.want)
			}
		})
	}
}

// voteFlowMock overrides only methods used by Vote; the rest come from mockRepository.
type voteFlowMock struct {
	*mockRepository
	contest     *model.Contest
	participant *model.Participant
	upsertNoms  []*string
}

func (v *voteFlowMock) GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	if v.contest != nil {
		return v.contest, nil
	}
	return v.mockRepository.GetContest(ctx, contestID)
}

func (v *voteFlowMock) GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error) {
	if v.participant != nil {
		return v.participant, nil
	}
	return v.mockRepository.GetParticipant(ctx, participantID)
}

func (v *voteFlowMock) UpsertContestVote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID, nominationID *string) (*model.Vote, error) {
	v.upsertNoms = append(v.upsertNoms, nominationID)
	nomCopy := nominationID
	return &model.Vote{
		ParticipantID: participantID,
		NominationID:  nomCopy,
	}, nil
}

func TestVote_PassesParticipantNominationToUpsert(t *testing.T) {
	t.Parallel()
	contestID := model.ContestID("cccccccc-cccc-cccc-cccc-cccccccccccc")
	partID := model.ParticipantID("pppppppp-pppp-pppp-pppp-pppppppppppp")
	nomID := "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

	contest := &model.Contest{
		ID:                  contestID,
		Status:              model.ContestStatusVoting,
		PublicVotingEnabled: true,
	}
	participant := &model.Participant{
		ID:               partID,
		ContestID:        contestID,
		NominationID:     &nomID,
		SubmissionStatus: model.ParticipantSubmissionAccepted,
	}

	repo := &voteFlowMock{
		mockRepository: &mockRepository{},
		contest:        contest,
		participant:    participant,
	}
	svc := &TopPetService{repository: repo}

	_, err := svc.Vote(context.Background(), contestID, partID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.upsertNoms) != 1 {
		t.Fatalf("expected 1 upsert, got %d", len(repo.upsertNoms))
	}
	if repo.upsertNoms[0] == nil || *repo.upsertNoms[0] != nomID {
		t.Fatalf("upsert nomination: got %v want %q", repo.upsertNoms[0], nomID)
	}
}

func TestVote_GeneralNominationUsesNilSlot(t *testing.T) {
	t.Parallel()
	contestID := model.ContestID("cccccccc-cccc-cccc-cccc-cccccccccccc")
	partID := model.ParticipantID("pppppppp-pppp-pppp-pppp-pppppppppppp")

	contest := &model.Contest{
		ID:                  contestID,
		Status:              model.ContestStatusVoting,
		PublicVotingEnabled: true,
	}
	participant := &model.Participant{
		ID:               partID,
		ContestID:        contestID,
		NominationID:     nil,
		SubmissionStatus: model.ParticipantSubmissionAccepted,
	}

	repo := &voteFlowMock{
		mockRepository: &mockRepository{},
		contest:        contest,
		participant:    participant,
	}
	svc := &TopPetService{repository: repo}

	_, err := svc.Vote(context.Background(), contestID, partID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.upsertNoms) != 1 || repo.upsertNoms[0] != nil {
		t.Fatalf("expected upsert with nil nomination slot, got %v", repo.upsertNoms)
	}
}

func TestVote_RejectsWhenNotVotingPhase(t *testing.T) {
	t.Parallel()
	contestID := model.ContestID("cccccccc-cccc-cccc-cccc-cccccccccccc")
	contest := &model.Contest{
		ID:                  contestID,
		Status:              model.ContestStatusRegistration,
		PublicVotingEnabled: true,
	}
	repo := &voteFlowMock{
		mockRepository: &mockRepository{},
		contest:        contest,
		participant:    &model.Participant{ID: "p", ContestID: contestID, SubmissionStatus: model.ParticipantSubmissionAccepted},
	}
	svc := &TopPetService{repository: repo}

	_, err := svc.Vote(context.Background(), contestID, "pppppppp-pppp-pppp-pppp-pppppppppppp", 1)
	if err == nil {
		t.Fatal("expected error")
	}
	if len(repo.upsertNoms) != 0 {
		t.Fatal("should not upsert when voting closed")
	}
}
