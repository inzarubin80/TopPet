//go:build integration

package integration

import (
	"context"
	"os"
	"strconv"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"toppet/server/internal/model"
	"toppet/server/internal/repository"
)

func integrationDBURL(t *testing.T) string {
	t.Helper()
	u := os.Getenv("INTEGRATION_DATABASE_URL")
	if u == "" {
		u = os.Getenv("TEST_DATABASE_URL")
	}
	if u == "" {
		t.Skip("set INTEGRATION_DATABASE_URL or TEST_DATABASE_URL to run integration tests")
	}
	return u
}

func integrationScale(t *testing.T) int {
	t.Helper()
	s := os.Getenv("INTEGRATION_SCALE")
	if s == "" {
		return 300
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 {
		t.Fatalf("invalid INTEGRATION_SCALE %q", s)
	}
	return n
}

func TestLargeContestFlow300x3x3x3(t *testing.T) {
	ctx := context.Background()
	dbURL := integrationDBURL(t)
	scale := integrationScale(t)
	if scale%3 != 0 {
		t.Fatalf("INTEGRATION_SCALE must be divisible by 3 (got %d)", scale)
	}

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	svc := NewIntegrationService(repository.NewRepository(pool))

	res, err := SeedLargeContestFlow(ctx, pool, SeedConfig{
		Scale:       scale,
		LeaveVoting: true,
	})
	if err != nil {
		t.Fatalf("SeedLargeContestFlow: %v", err)
	}
	contestID := res.ContestID
	org := res.OrganizerID
	t.Logf("contest_id=%s (open /contests/%s in the client after login as organizer user_id=%d)", contestID, contestID, org)

	rows, critTotal, juryCount, err := svc.GetJuryVotingProgressReportForContest(ctx, contestID, org)
	if err != nil {
		t.Fatalf("GetJuryVotingProgressReportForContest: %v", err)
	}
	if critTotal != 3 {
		t.Errorf("criteria_total: want 3, got %d", critTotal)
	}
	if juryCount != 3 {
		t.Errorf("jury_member_count: want 3, got %d", juryCount)
	}
	wantRows := int64(scale * 3)
	if int64(len(rows)) != wantRows {
		t.Errorf("progress rows: want %d, got %d", wantRows, len(rows))
	}

	viewer := org
	list, total, err := svc.ListParticipantsByContest(ctx, contestID, &viewer, nil, false, model.ParticipantListScopeAll, model.ParticipantListSubmissionAccepted, false, false, 10000, 0, "")
	if err != nil {
		t.Fatalf("ListParticipantsByContest: %v", err)
	}
	if total != int64(scale) {
		t.Errorf("participants total: want %d, got %d", scale, total)
	}
	if int64(len(list)) != int64(scale) {
		t.Errorf("participants list len: want %d, got %d", scale, len(list))
	}

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
	if len(finished.JuryWinners) != 3 {
		t.Errorf("JuryWinners: want 3, got %d (%+v)", len(finished.JuryWinners), finished.JuryWinners)
	}
	if len(finished.AudienceWinners) != 0 {
		t.Errorf("AudienceWinners: want 0 (public voting off), got %d", len(finished.AudienceWinners))
	}
}
