//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"toppet/server/internal/model"
	"toppet/server/internal/repository"
)

func TestJuryAndAudienceVotingFlow(t *testing.T) {
	ctx := context.Background()
	dbURL := integrationDBURL(t)

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	svc := NewIntegrationService(repository.NewRepository(pool))

	res, err := SeedJuryAndAudienceFlow(ctx, pool)
	if err != nil {
		t.Fatalf("SeedJuryAndAudienceFlow: %v", err)
	}
	contestID := res.ContestID
	org := res.OrganizerID

	t.Logf("contest_id=%s jury_winner_participant=%s audience_winner_participant=%s",
		contestID, res.JuryWinnerParticipantID, res.AudienceWinnerParticipantID)

	if _, err := svc.FinishContest(ctx, contestID, org); err != nil {
		t.Fatalf("FinishContest: %v", err)
	}

	finished, err := svc.GetContest(ctx, contestID)
	if err != nil {
		t.Fatalf("GetContest after finish: %v", err)
	}
	if finished.Status != model.ContestStatusFinished {
		t.Errorf("status: want finished, got %s", finished.Status)
	}

	if len(finished.JuryWinners) != 0 {
		t.Fatalf("JuryWinners: want 0 until chair assigns, got %d (%+v)", len(finished.JuryWinners), finished.JuryWinners)
	}

	if len(finished.AudienceWinners) != 1 {
		t.Fatalf("AudienceWinners: want 1, got %d (%+v)", len(finished.AudienceWinners), finished.AudienceWinners)
	}
	aw := finished.AudienceWinners[0]
	if aw.ParticipantID != res.AudienceWinnerParticipantID {
		t.Errorf("audience winner participant_id: want %s, got %s", res.AudienceWinnerParticipantID, aw.ParticipantID)
	}
	if aw.Score != res.AudienceVoteCount {
		t.Errorf("audience winner votes: want %d, got %d", res.AudienceVoteCount, aw.Score)
	}

	viewer := org
	list, _, err := svc.ListParticipantsByContest(ctx, contestID, &viewer, nil, false, model.ParticipantListScopeAll, model.ParticipantListSubmissionAccepted, false, false, 100, 0, "")
	if err != nil {
		t.Fatalf("ListParticipantsByContest: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("participants: want 3, got %d", len(list))
	}
	for _, p := range list {
		switch p.ID {
		case res.JuryWinnerParticipantID:
			if p.IsJuryWinner {
				t.Errorf("participant %s: IsJuryWinner want false until chair assigns", p.ID)
			}
			if p.IsAudienceWinner {
				t.Errorf("participant %s: IsAudienceWinner want false", p.ID)
			}
		case res.AudienceWinnerParticipantID:
			if !p.IsAudienceWinner {
				t.Errorf("participant %s: IsAudienceWinner want true", p.ID)
			}
			if p.IsJuryWinner {
				t.Errorf("participant %s: IsJuryWinner want false", p.ID)
			}
		default:
			if p.IsJuryWinner || p.IsAudienceWinner {
				t.Errorf("participant %s: unexpected winner flags jury=%v audience=%v", p.ID, p.IsJuryWinner, p.IsAudienceWinner)
			}
		}
	}
}
