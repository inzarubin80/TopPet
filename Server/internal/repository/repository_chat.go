package repository

import (
	"context"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (r *Repository) CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string, isSystem bool) (*model.ChatMessage, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID := uuid.New()
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	message, err := reposqlc.CreateChatMessage(ctx, &sqlc_repository.CreateChatMessageParams{
		ID:        pgtype.UUID{Bytes: messageUUID, Valid: true},
		ContestID: pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:    int64(userID),
		Text:      text,
		IsSystem:  isSystem,
	})
	if err != nil {
		return nil, err
	}

	var messageIDStr, contestIDStr string
	if message.ID.Valid {
		messageIDStr = uuid.UUID(message.ID.Bytes).String()
	}
	if message.ContestID.Valid {
		contestIDStr = uuid.UUID(message.ContestID.Bytes).String()
	}

	return &model.ChatMessage{
		ID:        model.ChatMessageID(messageIDStr),
		ContestID: model.ContestID(contestIDStr),
		UserID:    model.UserID(message.UserID),
		Text:      message.Text,
		IsSystem:  message.IsSystem,
		CreatedAt: message.CreatedAt.Time,
		UpdatedAt: message.UpdatedAt.Time,
	}, nil
}

func (r *Repository) ListChatMessages(ctx context.Context, contestID model.ContestID, limit, offset int) ([]*model.ChatMessage, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)

	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, 0, err
	}

	messages, err := reposqlc.ListChatMessages(ctx, &sqlc_repository.ListChatMessagesParams{
		ContestID: pgtype.UUID{Bytes: contestUUID, Valid: true},
		Limit:     int32(limit),
		Offset:    int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := reposqlc.CountChatMessages(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
	if err != nil {
		return nil, 0, err
	}

	result := make([]*model.ChatMessage, len(messages))
	for i, m := range messages {
		var messageIDStr, contestIDStr string
		if m.ID.Valid {
			messageIDStr = uuid.UUID(m.ID.Bytes).String()
		}
		if m.ContestID.Valid {
			contestIDStr = uuid.UUID(m.ContestID.Bytes).String()
		}

		result[i] = &model.ChatMessage{
			ID:        model.ChatMessageID(messageIDStr),
			ContestID: model.ContestID(contestIDStr),
			UserID:    model.UserID(m.UserID),
			Text:      m.Text,
			IsSystem:  m.IsSystem,
			CreatedAt: m.CreatedAt.Time,
			UpdatedAt: m.UpdatedAt.Time,
		}
	}

	return result, total, nil
}

func (r *Repository) UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID, err := uuid.Parse(string(messageID))
	if err != nil {
		return nil, err
	}

	message, err := reposqlc.UpdateChatMessage(ctx, &sqlc_repository.UpdateChatMessageParams{
		Text:   text,
		ID:     pgtype.UUID{Bytes: messageUUID, Valid: true},
		UserID: int64(userID),
	})
	if err != nil {
		return nil, err
	}

	var messageIDStr, contestIDStr string
	if message.ID.Valid {
		messageIDStr = uuid.UUID(message.ID.Bytes).String()
	}
	if message.ContestID.Valid {
		contestIDStr = uuid.UUID(message.ContestID.Bytes).String()
	}

	return &model.ChatMessage{
		ID:        model.ChatMessageID(messageIDStr),
		ContestID: model.ContestID(contestIDStr),
		UserID:    model.UserID(message.UserID),
		Text:      message.Text,
		IsSystem:  message.IsSystem,
		CreatedAt: message.CreatedAt.Time,
		UpdatedAt: message.UpdatedAt.Time,
	}, nil
}

func (r *Repository) DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) error {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID, err := uuid.Parse(string(messageID))
	if err != nil {
		return err
	}

	return reposqlc.DeleteChatMessage(ctx, &sqlc_repository.DeleteChatMessageParams{
		ID:     pgtype.UUID{Bytes: messageUUID, Valid: true},
		UserID: int64(userID),
	})
}
