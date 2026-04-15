package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"
)

func (r *Repository) DeleteUserAccount(ctx context.Context, userID model.UserID) error {
	b, ok := r.conn.(pgxBeginner)
	if !ok {
		return fmt.Errorf("repository does not support transactions")
	}
	tx, err := b.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	q := sqlc_repository.New(tx)
	uid := int64(userID)

	if err := q.DeleteParticipantConsentAuditsForUser(ctx, uid); err != nil {
		return err
	}

	participantRows, err := q.ListParticipantIDsByUserID(ctx, uid)
	if err != nil {
		return err
	}
	for _, row := range participantRows {
		if !row.Valid {
			continue
		}
		pid := model.ParticipantID(uuid.UUID(row.Bytes).String())
		if err := r.deleteParticipant(ctx, tx, pid); err != nil {
			return err
		}
	}

	if err := q.DeleteContestVotesByUserID(ctx, uid); err != nil {
		return err
	}
	if err := q.DeleteContestCommentsByUserID(ctx, uid); err != nil {
		return err
	}
	if err := q.DeleteChatMessagesByUserID(ctx, uid); err != nil {
		return err
	}
	if err := q.DeleteContestJuryMembersByUserID(ctx, uid); err != nil {
		return err
	}
	if err := q.DeletePaymentsByUserID(ctx, uid); err != nil {
		return err
	}
	if err := q.DeleteUserAuthProvidersByUserID(ctx, uid); err != nil {
		return err
	}
	if err := q.DeleteUser(ctx, uid); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
