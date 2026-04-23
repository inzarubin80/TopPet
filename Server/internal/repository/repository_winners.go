package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func participantScoreForWinnersFromContestRow(row *sqlc_repository.ListAcceptedParticipantScoresForContestRow) model.ParticipantScoreForWinners {
	if row == nil || !row.ParticipantID.Valid {
		return model.ParticipantScoreForWinners{}
	}
	pid := model.ParticipantID(uuid.UUID(row.ParticipantID.Bytes).String())
	var nom *string
	if row.NominationID.Valid {
		s := uuid.UUID(row.NominationID.Bytes).String()
		nom = &s
	}
	return model.ParticipantScoreForWinners{
		ParticipantID: pid,
		PetName:       row.PetName,
		NominationID:  nom,
		VoteCount:     row.VoteCnt,
		JurySum:       row.JurySum,
	}
}

func participantScoreForWinnersFromContestUserVoteRow(row *sqlc_repository.ListAcceptedParticipantUserVoteScoresForContestRow) model.ParticipantScoreForWinners {
	if row == nil || !row.ParticipantID.Valid {
		return model.ParticipantScoreForWinners{}
	}
	pid := model.ParticipantID(uuid.UUID(row.ParticipantID.Bytes).String())
	var nom *string
	if row.NominationID.Valid {
		s := uuid.UUID(row.NominationID.Bytes).String()
		nom = &s
	}
	return model.ParticipantScoreForWinners{
		ParticipantID: pid,
		PetName:       row.PetName,
		NominationID:  nom,
		VoteCount:     row.VoteCnt,
		JurySum:       row.JurySum,
	}
}

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
		s := participantScoreForWinnersFromContestRow(row)
		if s.ParticipantID == "" {
			continue
		}
		out = append(out, s)
	}
	return out, nil
}

func (r *Repository) ListAcceptedParticipantScoresForContests(ctx context.Context, contestIDs []model.ContestID) ([]model.ParticipantScoreForWinners, error) {
	if len(contestIDs) == 0 {
		return nil, nil
	}
	arr := make([]pgtype.UUID, 0, len(contestIDs))
	for _, cid := range contestIDs {
		u, err := uuid.Parse(string(cid))
		if err != nil {
			continue
		}
		arr = append(arr, pgtype.UUID{Bytes: u, Valid: true})
	}
	if len(arr) == 0 {
		return nil, nil
	}
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListAcceptedParticipantScoresForContests(ctx, arr)
	if err != nil {
		return nil, err
	}
	out := make([]model.ParticipantScoreForWinners, 0, len(rows))
	for _, row := range rows {
		if row == nil || !row.ParticipantID.Valid || !row.ContestID.Valid {
			continue
		}
		cid := model.ContestID(uuid.UUID(row.ContestID.Bytes).String())
		pid := model.ParticipantID(uuid.UUID(row.ParticipantID.Bytes).String())
		var nom *string
		if row.NominationID.Valid {
			s := uuid.UUID(row.NominationID.Bytes).String()
			nom = &s
		}
		out = append(out, model.ParticipantScoreForWinners{
			ContestID:     cid,
			ParticipantID: pid,
			PetName:       row.PetName,
			NominationID:  nom,
			VoteCount:     row.VoteCnt,
			JurySum:       row.JurySum,
		})
	}
	return out, nil
}

func (r *Repository) ListAcceptedParticipantUserVoteScoresForContest(ctx context.Context, contestID model.ContestID) ([]model.ParticipantScoreForWinners, error) {
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListAcceptedParticipantUserVoteScoresForContest(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
	if err != nil {
		return nil, err
	}
	out := make([]model.ParticipantScoreForWinners, 0, len(rows))
	for _, row := range rows {
		s := participantScoreForWinnersFromContestUserVoteRow(row)
		if s.ParticipantID == "" {
			continue
		}
		out = append(out, s)
	}
	return out, nil
}

func (r *Repository) ListAcceptedParticipantUserVoteScoresForContests(ctx context.Context, contestIDs []model.ContestID) ([]model.ParticipantScoreForWinners, error) {
	if len(contestIDs) == 0 {
		return nil, nil
	}
	arr := make([]pgtype.UUID, 0, len(contestIDs))
	for _, cid := range contestIDs {
		u, err := uuid.Parse(string(cid))
		if err != nil {
			continue
		}
		arr = append(arr, pgtype.UUID{Bytes: u, Valid: true})
	}
	if len(arr) == 0 {
		return nil, nil
	}
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListAcceptedParticipantUserVoteScoresForContests(ctx, arr)
	if err != nil {
		return nil, err
	}
	out := make([]model.ParticipantScoreForWinners, 0, len(rows))
	for _, row := range rows {
		if row == nil || !row.ParticipantID.Valid || !row.ContestID.Valid {
			continue
		}
		cid := model.ContestID(uuid.UUID(row.ContestID.Bytes).String())
		pid := model.ParticipantID(uuid.UUID(row.ParticipantID.Bytes).String())
		var nom *string
		if row.NominationID.Valid {
			s := uuid.UUID(row.NominationID.Bytes).String()
			nom = &s
		}
		out = append(out, model.ParticipantScoreForWinners{
			ContestID:     cid,
			ParticipantID: pid,
			PetName:       row.PetName,
			NominationID:  nom,
			VoteCount:     row.VoteCnt,
			JurySum:       row.JurySum,
		})
	}
	return out, nil
}
