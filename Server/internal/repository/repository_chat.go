package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (r *Repository) CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string, isSystem bool, parentID *model.ChatMessageID, imageURL string) (*model.ChatMessage, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID := uuid.New()
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	parentUUID := pgtype.UUID{}
	if parentID != nil && *parentID != "" {
		parsedParentID, parseErr := uuid.Parse(string(*parentID))
		if parseErr != nil {
			return nil, parseErr
		}
		parentUUID = pgtype.UUID{Bytes: parsedParentID, Valid: true}
	}

	message, err := reposqlc.CreateChatMessage(ctx, &sqlc_repository.CreateChatMessageParams{
		ID:        pgtype.UUID{Bytes: messageUUID, Valid: true},
		ContestID: pgtype.UUID{Bytes: contestUUID, Valid: true},
		UserID:    int64(userID),
		Text:      text,
		IsSystem:  isSystem,
		ParentID:  parentUUID,
		ImageUrl:  nonEmptyStringPtr(imageURL),
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

	// Get user name and avatar for the newly created message
	user, err := r.GetUser(ctx, model.UserID(message.UserID))
	userName := ""
	userAvatarURL := ""
	if err == nil && user != nil {
		userName = user.Name
		userAvatarURL = userAvatarURLFromUser(user)
	} else {
		userName = fmt.Sprintf("Пользователь %d", message.UserID)
	}

	var parentMessageID *model.ChatMessageID
	if message.ParentID.Valid {
		parentIDVal := model.ChatMessageID(uuid.UUID(message.ParentID.Bytes).String())
		parentMessageID = &parentIDVal
	}
	return &model.ChatMessage{
		ID:            model.ChatMessageID(messageIDStr),
		ContestID:     model.ContestID(contestIDStr),
		ParentID:      parentMessageID,
		UserID:        model.UserID(message.UserID),
		UserName:      userName,
		UserAvatarURL: userAvatarURL,
		Text:          message.Text,
		ImageURL:      optionalImageURL(message.ImageUrl),
		IsSystem:  message.IsSystem,
		Score:     0,
		UserVote:  0,
		CreatedAt: message.CreatedAt.Time,
		UpdatedAt: message.UpdatedAt.Time,
	}, nil
}

func (r *Repository) ListChatMessages(ctx context.Context, contestID model.ContestID, viewer *model.UserID, limit, offset int) ([]*model.ChatMessage, int64, error) {
	log.Printf("[Repository] ListChatMessages: Fetching chat messages for contest %s, limit %d, offset %d", contestID, limit, offset)
	reposqlc := sqlc_repository.New(r.conn)

	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		log.Printf("[Repository] ListChatMessages: ERROR - Failed to parse contestID %s: %v", contestID, err)
		return nil, 0, fmt.Errorf("invalid contest ID: %w", err)
	}

	log.Printf("[Repository] ListChatMessages: Executing SQL query with contestUUID=%s", contestUUID.String())
	var viewerUserID *int64
	if viewer != nil {
		v := int64(*viewer)
		viewerUserID = &v
	}

	messages, err := reposqlc.ListChatMessages(ctx, &sqlc_repository.ListChatMessagesParams{
		ContestID:    pgtype.UUID{Bytes: contestUUID, Valid: true},
		ViewerUserID: viewerUserID,
		Limit:        int32(limit),
		Offset:       int32(offset),
	})
	if err != nil {
		log.Printf("[Repository] ListChatMessages: ERROR - Failed to list chat messages from DB: %v", err)
		return nil, 0, fmt.Errorf("failed to list chat messages: %w", err)
	}
	log.Printf("[Repository] ListChatMessages: Retrieved %d messages from DB", len(messages))

	total, err := reposqlc.CountChatMessages(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
	if err != nil {
		log.Printf("[Repository] ListChatMessages: ERROR - Failed to count chat messages from DB: %v", err)
		return nil, 0, fmt.Errorf("failed to count chat messages: %w", err)
	}
	log.Printf("[Repository] ListChatMessages: Total messages count: %d", total)

	log.Printf("[Repository] ListChatMessages: Processing %d messages from DB", len(messages))
	result := make([]*model.ChatMessage, 0, len(messages))
	for i, m := range messages {
		log.Printf("[Repository] ListChatMessages: Processing message %d/%d", i+1, len(messages))

		var messageIDStr, contestIDStr string
		if !m.ID.Valid {
			log.Printf("[Repository] ListChatMessages: ERROR - Message %d has invalid ID, skipping", i)
			continue
		}
		messageIDStr = uuid.UUID(m.ID.Bytes).String()
		log.Printf("[Repository] ListChatMessages: Message ID: %s", messageIDStr)

		if !m.ContestID.Valid {
			log.Printf("[Repository] ListChatMessages: ERROR - Message %s has invalid ContestID, skipping", messageIDStr)
			continue
		}
		contestIDStr = uuid.UUID(m.ContestID.Bytes).String()
		log.Printf("[Repository] ListChatMessages: Contest ID: %s", contestIDStr)

		// Check if timestamps are valid
		if !m.CreatedAt.Valid {
			log.Printf("[Repository] ListChatMessages: WARNING - Message %s has invalid CreatedAt", messageIDStr)
		} else {
			log.Printf("[Repository] ListChatMessages: CreatedAt: %v", m.CreatedAt.Time)
		}
		if !m.UpdatedAt.Valid {
			log.Printf("[Repository] ListChatMessages: WARNING - Message %s has invalid UpdatedAt", messageIDStr)
		} else {
			log.Printf("[Repository] ListChatMessages: UpdatedAt: %v", m.UpdatedAt.Time)
		}

		log.Printf("[Repository] ListChatMessages: UserID: %d, UserName: %s, Text length: %d, IsSystem: %v",
			m.UserID, m.UserName, len(m.Text), m.IsSystem)

		userName := m.UserName
		if userName == "" {
			userName = "Пользователь " + fmt.Sprintf("%d", m.UserID)
			log.Printf("[Repository] ListChatMessages: UserName was empty, using default: %s", userName)
		}

		var parentMessageID *model.ChatMessageID
		if m.ParentID.Valid {
			parentIDVal := model.ChatMessageID(uuid.UUID(m.ParentID.Bytes).String())
			parentMessageID = &parentIDVal
		}

		chatMessage := &model.ChatMessage{
			ID:            model.ChatMessageID(messageIDStr),
			ContestID:     model.ContestID(contestIDStr),
			ParentID:      parentMessageID,
			UserID:        model.UserID(m.UserID),
			UserName:      userName,
			UserAvatarURL: optionalUserAvatarURL(m.UserAvatarUrl),
			Text:          m.Text,
			ImageURL:      optionalImageURL(m.ImageUrl),
			IsSystem:  m.IsSystem,
			Score:     m.Score,
			UserVote:  m.UserVote,
			CreatedAt: m.CreatedAt.Time,
			UpdatedAt: m.UpdatedAt.Time,
		}

		log.Printf("[Repository] ListChatMessages: Created ChatMessage: ID=%s, ContestID=%s, UserID=%d, UserName=%s",
			chatMessage.ID, chatMessage.ContestID, chatMessage.UserID, chatMessage.UserName)

		result = append(result, chatMessage)
	}
	log.Printf("[Repository] ListChatMessages: ===== SUCCESS: Processed %d messages (total %d) =====", len(result), total)
	return result, total, nil
}

func (r *Repository) chatMessageFromContestRow(ctx context.Context, message *sqlc_repository.ContestChatMessage) (*model.ChatMessage, error) {
	var messageIDStr, contestIDStr string
	if message.ID.Valid {
		messageIDStr = uuid.UUID(message.ID.Bytes).String()
	}
	if message.ContestID.Valid {
		contestIDStr = uuid.UUID(message.ContestID.Bytes).String()
	}

	user, err := r.GetUser(ctx, model.UserID(message.UserID))
	userName := ""
	userAvatarURL := ""
	if err == nil && user != nil {
		userName = user.Name
		userAvatarURL = userAvatarURLFromUser(user)
	} else {
		userName = fmt.Sprintf("Пользователь %d", message.UserID)
	}

	var parentMessageID *model.ChatMessageID
	if message.ParentID.Valid {
		parentIDVal := model.ChatMessageID(uuid.UUID(message.ParentID.Bytes).String())
		parentMessageID = &parentIDVal
	}
	return &model.ChatMessage{
		ID:            model.ChatMessageID(messageIDStr),
		ContestID:     model.ContestID(contestIDStr),
		ParentID:      parentMessageID,
		UserID:        model.UserID(message.UserID),
		UserName:      userName,
		UserAvatarURL: userAvatarURL,
		Text:          message.Text,
		ImageURL:      optionalImageURL(message.ImageUrl),
		IsSystem:      message.IsSystem,
		Score:         0,
		UserVote:      0,
		CreatedAt:     message.CreatedAt.Time,
		UpdatedAt:     message.UpdatedAt.Time,
	}, nil
}

func (r *Repository) GetChatMessage(ctx context.Context, messageID model.ChatMessageID) (*model.ChatMessage, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID, err := uuid.Parse(string(messageID))
	if err != nil {
		return nil, err
	}

	message, err := reposqlc.GetChatMessageByID(ctx, pgtype.UUID{Bytes: messageUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}
	return r.chatMessageFromContestRow(ctx, message)
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

	return r.chatMessageFromContestRow(ctx, message)
}

func (r *Repository) DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) (model.ContestID, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID, err := uuid.Parse(string(messageID))
	if err != nil {
		return "", err
	}

	contestID, err := reposqlc.DeleteChatMessage(ctx, &sqlc_repository.DeleteChatMessageParams{
		ID:     pgtype.UUID{Bytes: messageUUID, Valid: true},
		UserID: int64(userID),
	})
	if err != nil {
		return "", err
	}
	if !contestID.Valid {
		return "", errors.New("contest_id not found for deleted chat message")
	}
	return model.ContestID(uuid.UUID(contestID.Bytes).String()), nil
}

func (r *Repository) UpsertChatMessageVote(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, value int16) (model.ContestID, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)
	messageUUID, err := uuid.Parse(string(messageID))
	if err != nil {
		return "", 0, err
	}
	_, err = reposqlc.UpsertChatMessageVote(ctx, &sqlc_repository.UpsertChatMessageVoteParams{
		MessageID: pgtype.UUID{Bytes: messageUUID, Valid: true},
		UserID:    int64(userID),
		Value:     value,
	})
	if err != nil {
		return "", 0, err
	}
	stats, err := reposqlc.GetChatMessageVoteStats(ctx, pgtype.UUID{Bytes: messageUUID, Valid: true})
	if err != nil {
		return "", 0, err
	}
	if !stats.ContestID.Valid {
		return "", 0, errors.New("contest_id not found for chat message vote")
	}
	return model.ContestID(uuid.UUID(stats.ContestID.Bytes).String()), stats.Score, nil
}
