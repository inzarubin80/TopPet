package http

import (
	"context"
	"log"
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
	log.Printf("[ChatHandler] ===== START: Request to fetch chat messages =====")
	log.Printf("[ChatHandler] contestID from path: %s", contestID)
	log.Printf("[ChatHandler] Request URL: %s", r.URL.String())
	log.Printf("[ChatHandler] Request method: %s", r.Method)

	if contestID == "" {
		log.Printf("[ChatHandler] ERROR: contestId is required")
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		} else {
			log.Printf("[ChatHandler] WARNING: Invalid limit parameter: %s, using default 50", l)
		}
	}
	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil {
			offset = n
		} else {
			log.Printf("[ChatHandler] WARNING: Invalid offset parameter: %s, using default 0", o)
		}
	}

	log.Printf("[ChatHandler] Parameters: limit=%d, offset=%d", limit, offset)
	log.Printf("[ChatHandler] Calling service.ListChatMessages...")
	messages, total, err := h.service.ListChatMessages(r.Context(), contestID, limit, offset)
	if err != nil {
		log.Printf("[ChatHandler] ===== ERROR: Failed to list chat messages =====")
		log.Printf("[ChatHandler] contestID: %s", contestID)
		log.Printf("[ChatHandler] error type: %T", err)
		log.Printf("[ChatHandler] error message: %v", err)
		log.Printf("[ChatHandler] error details: %+v", err)
		uhttp.HandleError(w, err)
		return
	}

	log.Printf("[ChatHandler] Service returned: %d messages, total: %d", len(messages), total)
	log.Printf("[ChatHandler] Marshaling response to JSON...")
	type resp struct {
		Items []*model.ChatMessage `json:"items"`
		Total int64                `json:"total"`
	}
	log.Printf("[ChatHandler] ===== SUCCESS: Sending response =====")
	if err := uhttp.SendSuccess(w, resp{Items: messages, Total: total}); err != nil {
		log.Printf("[ChatHandler] ===== ERROR: Failed to send response =====")
		log.Printf("[ChatHandler] error: %v", err)
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
