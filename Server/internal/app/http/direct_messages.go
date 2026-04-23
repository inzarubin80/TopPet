package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type serviceDirectMessages interface {
	EnsureDirectConversationWithUser(ctx context.Context, ownerUserID, peerUserID model.UserID) (*model.DirectConversation, error)
	ListMyDirectConversations(ctx context.Context, userID model.UserID, limit, offset int) ([]*model.DirectConversation, int64, error)
	ListDirectMessages(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID, limit, offset int) ([]*model.DirectMessage, int64, error)
	CreateDirectMessage(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID, text string) (*model.DirectMessage, error)
	UpdateDirectMessage(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID, messageID model.DirectMessageID, text string) (*model.DirectMessage, error)
	DeleteDirectMessage(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID, messageID model.DirectMessageID) error
	DeleteDirectConversation(ctx context.Context, userID model.UserID, conversationID model.DirectConversationID) error
}

type DirectConversationsHandler struct {
	name    string
	service serviceDirectMessages
}

type DirectMessageHandler struct {
	name    string
	service serviceDirectMessages
}

func NewDirectMessageHandler(name string, service serviceDirectMessages) *DirectMessageHandler {
	return &DirectMessageHandler{name: name, service: service}
}

func (h *DirectMessageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	conversationID := model.DirectConversationID(r.PathValue("conversationId"))
	messageID := model.DirectMessageID(r.PathValue("messageId"))
	if conversationID == "" || messageID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("conversationId and messageId are required", nil))
		return
	}

	switch r.Method {
	case http.MethodPatch:
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
			return
		}
		message, err := h.service.UpdateDirectMessage(r.Context(), userID, conversationID, messageID, body.Text)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		if err := uhttp.SendSuccess(w, message); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
	case http.MethodDelete:
		if err := h.service.DeleteDirectMessage(r.Context(), userID, conversationID, messageID); err != nil {
			uhttp.HandleError(w, err)
			return
		}
		if err := uhttp.SendSuccess(w, map[string]bool{"ok": true}); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
	default:
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
	}
}

func NewDirectConversationsHandler(name string, service serviceDirectMessages) *DirectConversationsHandler {
	return &DirectConversationsHandler{name: name, service: service}
}

func (h *DirectConversationsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	switch r.Method {
	case http.MethodGet:
		limit := 50
		offset := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				limit = n
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				offset = n
			}
		}
		items, total, err := h.service.ListMyDirectConversations(r.Context(), userID, limit, offset)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		type resp struct {
			Items []*model.DirectConversation `json:"items"`
			Total int64                       `json:"total"`
		}
		if err := uhttp.SendSuccess(w, resp{Items: items, Total: total}); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
	case http.MethodPost:
		var body struct {
			UserID model.UserID `json:"user_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
			return
		}
		conversation, err := h.service.EnsureDirectConversationWithUser(r.Context(), userID, body.UserID)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		if err := uhttp.SendSuccess(w, conversation); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
	default:
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
	}
}

type DirectConversationMessagesHandler struct {
	name    string
	service serviceDirectMessages
}

func NewDirectConversationMessagesHandler(name string, service serviceDirectMessages) *DirectConversationMessagesHandler {
	return &DirectConversationMessagesHandler{name: name, service: service}
}

type DirectConversationDeleteHandler struct {
	name    string
	service serviceDirectMessages
}

func NewDirectConversationDeleteHandler(name string, service serviceDirectMessages) *DirectConversationDeleteHandler {
	return &DirectConversationDeleteHandler{name: name, service: service}
}

func (h *DirectConversationDeleteHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	conversationID := model.DirectConversationID(r.PathValue("conversationId"))
	if conversationID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("conversationId is required", nil))
		return
	}
	if err := h.service.DeleteDirectConversation(r.Context(), userID, conversationID); err != nil {
		uhttp.HandleError(w, err)
		return
	}
	if err := uhttp.SendSuccess(w, map[string]bool{"ok": true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

func (h *DirectConversationMessagesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	conversationID := model.DirectConversationID(r.PathValue("conversationId"))
	if conversationID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("conversationId is required", nil))
		return
	}

	switch r.Method {
	case http.MethodGet:
		limit := 50
		offset := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				limit = n
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				offset = n
			}
		}
		items, total, err := h.service.ListDirectMessages(r.Context(), userID, conversationID, limit, offset)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		type resp struct {
			Items []*model.DirectMessage `json:"items"`
			Total int64                  `json:"total"`
		}
		if err := uhttp.SendSuccess(w, resp{Items: items, Total: total}); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
	case http.MethodPost:
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
			return
		}
		message, err := h.service.CreateDirectMessage(r.Context(), userID, conversationID, body.Text)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		if err := uhttp.SendSuccess(w, message); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
	default:
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
	}
}
