package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func int64FromInterface(v interface{}) int64 {
	switch x := v.(type) {
	case int64:
		return x
	case int32:
		return int64(x)
	case int:
		return int64(x)
	default:
		return 0
	}
}

func stringFromInterface(v interface{}) string {
	switch x := v.(type) {
	case string:
		return x
	case []byte:
		return string(x)
	default:
		return ""
	}
}

func directConversationFromRow(row *sqlc_repository.DirectConversation, peerUserID model.UserID, peerName string, peerAvatarURL string, lastMessageText string, lastMessageCreatedAt *time.Time) *model.DirectConversation {
	id := ""
	if row.ID.Valid {
		id = uuid.UUID(row.ID.Bytes).String()
	}

	return &model.DirectConversation{
		ID:                  model.DirectConversationID(id),
		UserLowID:           model.UserID(row.UserLowID),
		UserHighID:          model.UserID(row.UserHighID),
		PeerUserID:          peerUserID,
		PeerUserName:        peerName,
		PeerUserAvatarURL:   peerAvatarURL,
		LastMessageText:     lastMessageText,
		LastMessageCreatedAt: lastMessageCreatedAt,
		LastMessageAt:       row.LastMessageAt.Time,
		CreatedAt:           row.CreatedAt.Time,
		UpdatedAt:           row.UpdatedAt.Time,
	}
}

func buildDirectConversationForUser(row *sqlc_repository.DirectConversation, userID model.UserID) *model.DirectConversation {
	peerID := model.UserID(row.UserLowID)
	if peerID == userID {
		peerID = model.UserID(row.UserHighID)
	}
	return directConversationFromRow(row, peerID, fmt.Sprintf("Пользователь %d", peerID), "", "", nil)
}

func (r *Repository) GetDirectConversationByID(ctx context.Context, conversationID model.DirectConversationID) (*model.DirectConversation, error) {
	reposqlc := sqlc_repository.New(r.conn)
	conversationUUID, err := uuid.Parse(string(conversationID))
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.GetDirectConversationByID(ctx, pgtype.UUID{Bytes: conversationUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, model.ErrorNotFound
		}
		return nil, err
	}
	return buildDirectConversationForUser(row, model.UserID(row.UserLowID)), nil
}

func (r *Repository) GetDirectConversationForUser(ctx context.Context, conversationID model.DirectConversationID, userID model.UserID) (*model.DirectConversation, error) {
	reposqlc := sqlc_repository.New(r.conn)
	conversationUUID, err := uuid.Parse(string(conversationID))
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.GetDirectConversationForUser(ctx, &sqlc_repository.GetDirectConversationForUserParams{
		ConversationID: pgtype.UUID{Bytes: conversationUUID, Valid: true},
		UserID:         int64(userID),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, model.ErrorNotFound
		}
		return nil, err
	}
	return buildDirectConversationForUser(row, userID), nil
}

func (r *Repository) GetDirectConversationByPair(ctx context.Context, userAID, userBID model.UserID) (*model.DirectConversation, error) {
	reposqlc := sqlc_repository.New(r.conn)
	row, err := reposqlc.GetDirectConversationByPair(ctx, &sqlc_repository.GetDirectConversationByPairParams{
		UserAID: int64(userAID),
		UserBID: int64(userBID),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, model.ErrorNotFound
		}
		return nil, err
	}
	return buildDirectConversationForUser(row, userAID), nil
}

func (r *Repository) GetOrCreateDirectConversationByPair(ctx context.Context, userAID, userBID model.UserID) (*model.DirectConversation, error) {
	reposqlc := sqlc_repository.New(r.conn)
	row, err := reposqlc.GetOrCreateDirectConversationByPair(ctx, &sqlc_repository.GetOrCreateDirectConversationByPairParams{
		UserAID: int64(userAID),
		UserBID: int64(userBID),
	})
	if err != nil {
		return nil, err
	}
	return buildDirectConversationForUser(row, userAID), nil
}

func (r *Repository) ListDirectConversationsByUser(ctx context.Context, userID model.UserID, limit, offset int) ([]*model.DirectConversation, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListDirectConversationsByUser(ctx, &sqlc_repository.ListDirectConversationsByUserParams{
		UserID:     int64(userID),
		ListLimit:  int32(limit),
		ListOffset: int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}
	total, err := reposqlc.CountDirectConversationsByUser(ctx, int64(userID))
	if err != nil {
		return nil, 0, err
	}
	out := make([]*model.DirectConversation, 0, len(rows))
	for _, row := range rows {
		var lastCreatedAt *time.Time
		if row.LastMessageCreatedAt.Valid {
			t := row.LastMessageCreatedAt.Time
			lastCreatedAt = &t
		}
		out = append(out, &model.DirectConversation{
			ID:                  model.DirectConversationID(uuid.UUID(row.ID.Bytes).String()),
			UserLowID:           model.UserID(row.UserLowID),
			UserHighID:          model.UserID(row.UserHighID),
			PeerUserID:          model.UserID(int64FromInterface(row.PeerUserID)),
			PeerUserName:        row.PeerUserName,
			PeerUserAvatarURL:   optionalUserAvatarURL(row.PeerUserAvatarUrl),
			LastMessageText:     stringFromInterface(row.LastMessageText),
			LastMessageCreatedAt: lastCreatedAt,
			LastMessageAt:       row.LastMessageAt.Time,
			CreatedAt:           row.CreatedAt.Time,
			UpdatedAt:           row.UpdatedAt.Time,
		})
	}
	return out, total, nil
}

func (r *Repository) CreateDirectMessage(ctx context.Context, conversationID model.DirectConversationID, senderUserID model.UserID, text string) (*model.DirectMessage, error) {
	reposqlc := sqlc_repository.New(r.conn)
	conversationUUID, err := uuid.Parse(string(conversationID))
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.CreateDirectMessage(ctx, &sqlc_repository.CreateDirectMessageParams{
		ConversationID: pgtype.UUID{Bytes: conversationUUID, Valid: true},
		SenderUserID:   int64(senderUserID),
		Text:           text,
	})
	if err != nil {
		return nil, err
	}
	if err := reposqlc.TouchDirectConversation(ctx, pgtype.UUID{Bytes: conversationUUID, Valid: true}); err != nil {
		return nil, err
	}

	sender, err := r.GetUser(ctx, senderUserID)
	senderName := fmt.Sprintf("Пользователь %d", senderUserID)
	senderAvatar := ""
	if err == nil && sender != nil {
		if sender.Name != "" {
			senderName = sender.Name
		}
		senderAvatar = userAvatarURLFromUser(sender)
	}

	return &model.DirectMessage{
		ID:                  model.DirectMessageID(uuid.UUID(row.ID.Bytes).String()),
		ConversationID:      model.DirectConversationID(uuid.UUID(row.ConversationID.Bytes).String()),
		SenderUserID:        model.UserID(row.SenderUserID),
		SenderUserName:      senderName,
		SenderUserAvatarURL: senderAvatar,
		Text:                row.Text,
		CreatedAt:           row.CreatedAt.Time,
		UpdatedAt:           row.UpdatedAt.Time,
	}, nil
}

func (r *Repository) ListDirectMessagesByConversation(ctx context.Context, conversationID model.DirectConversationID, limit, offset int) ([]*model.DirectMessage, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	conversationUUID, err := uuid.Parse(string(conversationID))
	if err != nil {
		return nil, 0, err
	}
	rows, err := reposqlc.ListDirectMessagesByConversation(ctx, &sqlc_repository.ListDirectMessagesByConversationParams{
		ConversationID: pgtype.UUID{Bytes: conversationUUID, Valid: true},
		ListLimit:      int32(limit),
		ListOffset:     int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}
	total, err := reposqlc.CountDirectMessagesByConversation(ctx, pgtype.UUID{Bytes: conversationUUID, Valid: true})
	if err != nil {
		return nil, 0, err
	}

	out := make([]*model.DirectMessage, 0, len(rows))
	for _, row := range rows {
		out = append(out, &model.DirectMessage{
			ID:                  model.DirectMessageID(uuid.UUID(row.ID.Bytes).String()),
			ConversationID:      model.DirectConversationID(uuid.UUID(row.ConversationID.Bytes).String()),
			SenderUserID:        model.UserID(row.SenderUserID),
			SenderUserName:      row.SenderUserName,
			SenderUserAvatarURL: optionalUserAvatarURL(row.SenderUserAvatarUrl),
			Text:                row.Text,
			CreatedAt:           row.CreatedAt.Time,
			UpdatedAt:           row.UpdatedAt.Time,
		})
	}
	return out, total, nil
}

func directMessageFromRow(row *sqlc_repository.DirectMessage) *model.DirectMessage {
	if row == nil {
		return nil
	}
	return &model.DirectMessage{
		ID:             model.DirectMessageID(uuid.UUID(row.ID.Bytes).String()),
		ConversationID: model.DirectConversationID(uuid.UUID(row.ConversationID.Bytes).String()),
		SenderUserID:   model.UserID(row.SenderUserID),
		Text:           row.Text,
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
	}
}

func (r *Repository) GetDirectMessageByID(ctx context.Context, messageID model.DirectMessageID) (*model.DirectMessage, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID, err := uuid.Parse(string(messageID))
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.GetDirectMessageByID(ctx, pgtype.UUID{Bytes: messageUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, model.ErrorNotFound
		}
		return nil, err
	}
	message := directMessageFromRow(row)
	if message == nil {
		return nil, model.ErrorNotFound
	}
	user, err := r.GetUser(ctx, message.SenderUserID)
	if err == nil && user != nil {
		message.SenderUserName = user.Name
		message.SenderUserAvatarURL = userAvatarURLFromUser(user)
	} else {
		message.SenderUserName = fmt.Sprintf("Пользователь %d", message.SenderUserID)
	}
	return message, nil
}

func (r *Repository) UpdateDirectMessageByID(ctx context.Context, messageID model.DirectMessageID, text string) (*model.DirectMessage, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID, err := uuid.Parse(string(messageID))
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.UpdateDirectMessageByID(ctx, &sqlc_repository.UpdateDirectMessageByIDParams{
		MessageID: pgtype.UUID{Bytes: messageUUID, Valid: true},
		Text:      text,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, model.ErrorNotFound
		}
		return nil, err
	}
	return r.GetDirectMessageByID(ctx, model.DirectMessageID(uuid.UUID(row.ID.Bytes).String()))
}

func (r *Repository) DeleteDirectMessageByID(ctx context.Context, messageID model.DirectMessageID) (*model.DirectMessage, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID, err := uuid.Parse(string(messageID))
	if err != nil {
		return nil, err
	}
	row, err := reposqlc.DeleteDirectMessageByID(ctx, pgtype.UUID{Bytes: messageUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, model.ErrorNotFound
		}
		return nil, err
	}
	msg := directMessageFromRow(row)
	if msg == nil {
		return nil, model.ErrorNotFound
	}
	return msg, nil
}
