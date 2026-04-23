package ws

import "toppet/server/internal/model"

// MessageType представляет тип WebSocket сообщения
type MessageType string

const (
	MessageTypeContestStatusUpdated MessageType = "contest_status_updated"
	MessageTypeVoteCreated          MessageType = "vote_created"
	MessageTypeVoteDeleted          MessageType = "vote_deleted"
	MessageTypeUserVoteUpdated      MessageType = "user_vote_updated"
	MessageTypeChatMessage          MessageType = "chat_message"
	MessageTypeMessageUpdated          MessageType = "message_updated"
	MessageTypeMessageDeleted          MessageType = "message_deleted"
	MessageTypeChatMessageVoteUpdated  MessageType = "chat_message_vote_updated"
	MessageTypeParticipantUpdated   MessageType = "participant_updated"
	MessageTypeParticipantDeleted   MessageType = "participant_deleted"
	MessageTypeParticipantCommentCreated     MessageType = "participant_comment_created"
	MessageTypeParticipantCommentUpdated     MessageType = "participant_comment_updated"
	MessageTypeParticipantCommentDeleted     MessageType = "participant_comment_deleted"
	MessageTypeParticipantCommentVoteUpdated MessageType = "participant_comment_vote_updated"
	MessageTypeUserNotification       MessageType = "notification"
	MessageTypeNotificationUnread     MessageType = "notification_unread"
	MessageTypeDirectMessage          MessageType = "direct_message"
	MessageTypeDirectMessageUpdated   MessageType = "direct_message_updated"
	MessageTypeDirectMessageDeleted   MessageType = "direct_message_deleted"
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
	NominationID  *string         `json:"nomination_id,omitempty"`
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

// ParticipantUpdatedPayload — снимок заявки для галереи (как в списке участников).
type ParticipantUpdatedPayload struct {
	Type        MessageType       `json:"type"`
	ContestID   model.ContestID   `json:"contest_id"`
	Participant *model.Participant `json:"participant"`
}

// NotificationUnreadSnapshot — число непрочитанных при подключении WS.
type NotificationUnreadSnapshot struct {
	Type        MessageType `json:"type"`
	TotalUnread int64       `json:"total_unread"`
}

// UserNotificationEnvelope — персональное уведомление (все конкурсы пользователя).
type UserNotificationEnvelope struct {
	Type           MessageType            `json:"type"`
	Notification   *model.UserNotification `json:"notification"`
}

// DirectMessagePayload — новое сообщение в личном диалоге.
type DirectMessagePayload struct {
	Type           MessageType                `json:"type"`
	ConversationID model.DirectConversationID `json:"conversation_id"`
	Message        *model.DirectMessage       `json:"message"`
}

type DirectMessageUpdatedPayload struct {
	Type           MessageType                `json:"type"`
	ConversationID model.DirectConversationID `json:"conversation_id"`
	Message        *model.DirectMessage       `json:"message"`
}

type DirectMessageDeletedPayload struct {
	Type           MessageType                `json:"type"`
	ConversationID model.DirectConversationID `json:"conversation_id"`
	MessageID      model.DirectMessageID      `json:"message_id"`
}

// ParticipantDeletedPayload — заявка удалена из конкурса.
type ParticipantDeletedPayload struct {
	Type            MessageType         `json:"type"`
	ContestID       model.ContestID     `json:"contest_id"`
	ParticipantID   model.ParticipantID `json:"participant_id"`
}

// ChatMessageVoteUpdatedPayload — обновление суммы голосов сообщения чата (для всех подписчиков).
// VoterUserID/VoterValue — кто голосовал и какое значение записано; клиент совмещает с сессией, чтобы обновить user_vote.
type ChatMessageVoteUpdatedPayload struct {
	Type        MessageType         `json:"type"`
	ContestID   model.ContestID     `json:"contest_id"`
	MessageID   model.ChatMessageID `json:"message_id"`
	Score       int64               `json:"score"`
	VoterUserID model.UserID        `json:"voter_user_id"`
	VoterValue  int16               `json:"voter_value"`
}

// ParticipantCommentCreatedPayload — новый комментарий к работе участника.
type ParticipantCommentCreatedPayload struct {
	Type      MessageType     `json:"type"`
	ContestID model.ContestID `json:"contest_id"`
	Comment   *model.Comment  `json:"comment"`
}

// ParticipantCommentUpdatedPayload — текст комментария к работе изменён.
type ParticipantCommentUpdatedPayload struct {
	Type      MessageType     `json:"type"`
	ContestID model.ContestID `json:"contest_id"`
	Comment   *model.Comment  `json:"comment"`
}

// ParticipantCommentDeletedPayload — комментарий к работе удалён.
type ParticipantCommentDeletedPayload struct {
	Type          MessageType         `json:"type"`
	ContestID     model.ContestID     `json:"contest_id"`
	ParticipantID model.ParticipantID `json:"participant_id"`
	CommentID     model.CommentID     `json:"comment_id"`
}

// ParticipantCommentVoteUpdatedPayload — голос за комментарий к работе (сумма и голосующий).
type ParticipantCommentVoteUpdatedPayload struct {
	Type          MessageType         `json:"type"`
	ContestID     model.ContestID     `json:"contest_id"`
	ParticipantID model.ParticipantID `json:"participant_id"`
	CommentID     model.CommentID     `json:"comment_id"`
	Score         int64               `json:"score"`
	VoterUserID   model.UserID        `json:"voter_user_id"`
	VoterValue    int16               `json:"voter_value"`
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
