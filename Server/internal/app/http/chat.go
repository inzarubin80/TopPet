package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceChat interface {
		ListChatMessages(ctx context.Context, contestID model.ContestID, limit, offset int) ([]*model.ChatMessage, int64, error)
	}

	ChatHandler struct {
		name    string
		service serviceChat
	}
)

func NewChatHandler(name string, service serviceChat) *ChatHandler {
	return &ChatHandler{name: name, service: service}
}

func (h *ChatHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	contestID := model.ContestID(r.PathValue("contestId"))

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}
	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil {
			offset = n
		}
	}

	messages, total, err := h.service.ListChatMessages(r.Context(), contestID, limit, offset)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	type resp struct {
		Items []*model.ChatMessage `json:"items"`
		Total int64                `json:"total"`
	}
	jsonData, _ := json.Marshal(resp{Items: messages, Total: total})
	uhttp.SendSuccessfulResponse(w, jsonData)
}
