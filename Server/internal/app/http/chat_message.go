package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceChatMessage interface {
		UpdateChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID, text string) (*model.ChatMessage, error)
		DeleteChatMessage(ctx context.Context, messageID model.ChatMessageID, userID model.UserID) error
	}

	ChatMessageHandler struct {
		name    string
		service serviceChatMessage
	}
)

func NewChatMessageHandler(name string, service serviceChatMessage) *ChatMessageHandler {
	return &ChatMessageHandler{name: name, service: service}
}

func (h *ChatMessageHandler) UpdateChatMessage(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	messageID := model.ChatMessageID(r.PathValue("messageId"))

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	message, err := h.service.UpdateChatMessage(r.Context(), messageID, userID, req.Text)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(message)
	uhttp.SendSuccessfulResponse(w, jsonData)
}

func (h *ChatMessageHandler) DeleteChatMessage(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	messageID := model.ChatMessageID(r.PathValue("messageId"))

	if err := h.service.DeleteChatMessage(r.Context(), messageID, userID); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	uhttp.SendSuccessfulResponse(w, []byte(`{"ok":true}`))
}
