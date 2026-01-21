package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"
)

type (
	contestChatService interface {
		CreateChatMessage(ctx context.Context, contestID model.ContestID, userID model.UserID, text string) (*model.ChatMessage, error)
	}

	ContestChatWSHandler struct {
		name    string
		service contestChatService
		hub     *wsapp.Hub
	}
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func NewContestChatWSHandler(name string, svc contestChatService, hub *wsapp.Hub) *ContestChatWSHandler {
	return &ContestChatWSHandler{name: name, service: svc, hub: hub}
}

type wsIncomingMessage struct {
	Type      string `json:"type"`
	ContestID string `json:"contest_id"`
	Text      string `json:"text"`
}

func (h *ContestChatWSHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Extract userID from context (set by auth middleware if provided)
	userIDVal := r.Context().Value(defenitions.UserID)
	if userIDVal == nil {
		// Try query param for WS
		userIDStr := r.URL.Query().Get("user_id")
		if userIDStr == "" {
			uhttp.SendErrorResponse(w, http.StatusUnauthorized, "user_id is required")
			return
		}
		userIDNum, err := strconv.ParseInt(userIDStr, 10, 64)
		if err != nil || userIDNum <= 0 {
			uhttp.SendErrorResponse(w, http.StatusUnauthorized, "invalid user_id")
			return
		}
		userIDVal = model.UserID(userIDNum)
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	userID := userIDVal.(model.UserID)
	client := &wsapp.Client{
		Conn:     conn,
		UserID:   userID,
		Contests: make(map[model.ContestID]struct{}),
		Send:     make(chan any, 32),
		Hub:      h.hub,
	}

	h.hub.RegisterClient(client)

	go client.WritePump()
	client.ReadPump(func(raw []byte) {
		var msg wsIncomingMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			return
		}

		switch msg.Type {
		case "subscribe":
			if msg.ContestID != "" {
				client.Subscribe(model.ContestID(msg.ContestID))
			}
		case "message":
			if msg.ContestID == "" || msg.Text == "" {
				return
			}
			_, err := h.service.CreateChatMessage(
				r.Context(),
				model.ContestID(msg.ContestID),
				userID,
				msg.Text,
			)
			if err != nil {
				return
			}
		}
	})
}
