package ws

import "toppet/server/internal/model"

// MessageType представляет тип WebSocket сообщения
type MessageType string

const (
	MessageTypeContestStatusUpdated MessageType = "contest_status_updated"
	MessageTypeVoteCreated          MessageType = "vote_created"
	MessageTypeVoteDeleted          MessageType = "vote_deleted"
	MessageTypeChatMessage          MessageType = "chat_message"
	MessageTypeMessageUpdated       MessageType = "message_updated"
	MessageTypeMessageDeleted       MessageType = "message_deleted"
)

// ContestStatusUpdatedPayload представляет payload для обновления статуса конкурса
type ContestStatusUpdatedPayload struct {
	Type      MessageType     `json:"type"`
	ContestID model.ContestID `json:"contest_id"`
	Status    string          `json:"status"`
}

// VotePayload представляет payload для голосования
type VotePayload struct {
	Type          MessageType     `json:"type"`
	ContestID     model.ContestID `json:"contest_id"`
	ParticipantID model.ParticipantID `json:"participant_id,omitempty"`
}

// ChatMessagePayload представляет payload для сообщения чата
type ChatMessagePayload struct {
	Type      MessageType     `json:"type"`
	ContestID model.ContestID `json:"contest_id"`
	Message   interface{}     `json:"message"` // Используем interface{} так как это может быть разная структура
}

// VoteCountsUpdatedPayload представляет payload для обновления счетчиков голосов
type VoteCountsUpdatedPayload struct {
	Type                MessageType     `json:"type"`
	ContestID           model.ContestID `json:"contest_id"`
	ParticipantID       model.ParticipantID `json:"participant_id"`
	ParticipantTotalVotes int64         `json:"participant_total_votes"`
	ContestTotalVotes   int64           `json:"contest_total_votes"`
}

// UserVoteUpdatedPayload представляет payload для обновления голоса пользователя
type UserVoteUpdatedPayload struct {
	Type          MessageType     `json:"type"`
	ContestID     model.ContestID `json:"contest_id"`
	ParticipantID model.ParticipantID `json:"participant_id"`
}

// MessageUpdatedPayload представляет payload для обновления сообщения
type MessageUpdatedPayload struct {
	Type      MessageType     `json:"type"`
	ContestID model.ContestID `json:"contest_id"`
	Message   interface{}     `json:"message"`
}

// MessageDeletedPayload представляет payload для удаления сообщения
type MessageDeletedPayload struct {
	Type      MessageType     `json:"type"`
	ContestID model.ContestID `json:"contest_id"`
	MessageID model.ChatMessageID `json:"message_id"`
}

// NewMessagePayload представляет payload для нового сообщения
type NewMessagePayload struct {
	Type      MessageType     `json:"type"`
	ContestID model.ContestID `json:"contest_id"`
	Message   interface{}     `json:"message"`
}

// NewContestStatusUpdatedPayload создает payload для обновления статуса конкурса
func NewContestStatusUpdatedPayload(contestID model.ContestID, status string) ContestStatusUpdatedPayload {
	return ContestStatusUpdatedPayload{
		Type:      MessageTypeContestStatusUpdated,
		ContestID: contestID,
		Status:    status,
	}
}

// NewVoteCreatedPayload создает payload для создания голоса
func NewVoteCreatedPayload(contestID model.ContestID, participantID model.ParticipantID) VotePayload {
	return VotePayload{
		Type:          MessageTypeVoteCreated,
		ContestID:     contestID,
		ParticipantID: participantID,
	}
}

// NewVoteDeletedPayload создает payload для удаления голоса
func NewVoteDeletedPayload(contestID model.ContestID) VotePayload {
	return VotePayload{
		Type:      MessageTypeVoteDeleted,
		ContestID: contestID,
	}
}
