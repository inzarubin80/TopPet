package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func (r *Repository) ListAcceptedParticipantScoresForContest(ctx context.Context, contestID model.ContestID) ([]model.ParticipantScoreForWinners, error) {
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListAcceptedParticipantScoresForContest(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
	if err != nil {
		return nil, err
	}
	out := make([]model.ParticipantScoreForWinners, 0, len(rows))
	for _, row := range rows {
		if !row.ParticipantID.Valid {
			continue
		}
		pid := model.ParticipantID(uuid.UUID(row.ParticipantID.Bytes).String())
		var nom *string
		if row.NominationID.Valid {
			s := uuid.UUID(row.NominationID.Bytes).String()
			nom = &s
		}
		out = append(out, model.ParticipantScoreForWinners{
			ParticipantID: pid,
			NominationID:  nom,
			VoteCount:     row.VoteCnt,
			JurySum:       row.JurySum,
		})
	}
	return out, nil
}
