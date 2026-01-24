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
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	message, err := h.service.UpdateChatMessage(r.Context(), messageID, userID, req.Text)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, message); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}

func (h *ChatMessageHandler) DeleteChatMessage(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	messageID := model.ChatMessageID(r.PathValue("messageId"))

	if err := h.service.DeleteChatMessage(r.Context(), messageID, userID); err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type response struct {
		OK bool `json:"ok"`
	}
	if err := uhttp.SendSuccess(w, response{OK: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
