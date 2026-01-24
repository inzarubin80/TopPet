package http

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

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

	serviceAuth interface {
		Authorization(ctx context.Context, accessToken string) (*model.Claims, error)
	}

	ContestChatWSHandler struct {
		name    string
		service contestChatService
		authService serviceAuth
		hub     *wsapp.Hub
	}
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func NewContestChatWSHandler(name string, svc contestChatService, authSvc serviceAuth, hub *wsapp.Hub) *ContestChatWSHandler {
	return &ContestChatWSHandler{name: name, service: svc, authService: authSvc, hub: hub}
}

type wsIncomingMessage struct {
	Type      string `json:"type"`
	ContestID string `json:"contest_id"`
	Text      string `json:"text"`
}

func (h *ContestChatWSHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	log.Printf("[WS] New WebSocket connection attempt from %s, path: %s", r.RemoteAddr, r.URL.Path)
	
	var userID model.UserID
	
	// First, try to get userID from context (set by auth middleware if provided)
	userIDVal := r.Context().Value(defenitions.UserID)
	if userIDVal != nil {
		userID = userIDVal.(model.UserID)
		log.Printf("[WS] UserID %d extracted from context", userID)
	} else {
		// Try to get accessToken from query params and validate it
		accessToken := r.URL.Query().Get("accessToken")
		if accessToken == "" {
			// Try Authorization header
			authHeader := r.Header.Get("Authorization")
			if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
				accessToken = authHeader[7:]
				log.Printf("[WS] Access token found in Authorization header")
			}
		} else {
			log.Printf("[WS] Access token found in query params")
		}
		
		if accessToken == "" {
			log.Printf("[WS] ERROR: No access token provided, rejecting connection")
			uhttp.SendErrorResponse(w, http.StatusUnauthorized, "access token is required")
			return
		}
		
		// Validate token and extract userID
		log.Printf("[WS] Validating access token...")
		claims, err := h.authService.Authorization(r.Context(), accessToken)
		if err != nil {
			log.Printf("[WS] ERROR: Invalid access token: %v", err)
			uhttp.SendErrorResponse(w, http.StatusUnauthorized, "invalid access token")
			return
		}
		
		userID = claims.UserID
		log.Printf("[WS] Access token validated, UserID: %d", userID)
	}

	log.Printf("[WS] Upgrading HTTP connection to WebSocket for user %d...", userID)
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] ERROR: Failed to upgrade connection: %v", err)
		return
	}
	
	log.Printf("[WS] WebSocket connection established successfully for user %d", userID)
	client := &wsapp.Client{
		Conn:     conn,
		UserID:   userID,
		Contests: make(map[model.ContestID]struct{}),
		Send:     make(chan any, 32),
		Hub:      h.hub,
	}

	log.Printf("[WS] Registering client for user %d in hub", userID)
	h.hub.RegisterClient(client)

	log.Printf("[WS] Starting WritePump for user %d", userID)
	go client.WritePump()
	
	log.Printf("[WS] Starting ReadPump for user %d", userID)
	client.ReadPump(func(raw []byte) {
		var msg wsIncomingMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			log.Printf("[WS] ERROR: Failed to unmarshal message from user %d: %v", userID, err)
			return
		}

		log.Printf("[WS] Received message from user %d: type=%s, contest_id=%s", userID, msg.Type, msg.ContestID)

		switch msg.Type {
		case "subscribe":
			if msg.ContestID != "" {
				log.Printf("[WS] User %d subscribing to contest %s", userID, msg.ContestID)
				client.Subscribe(model.ContestID(msg.ContestID))
			} else {
				log.Printf("[WS] WARNING: Subscribe message from user %d has empty contest_id", userID)
			}
		case "message":
			if msg.ContestID == "" || msg.Text == "" {
				log.Printf("[WS] WARNING: Message from user %d has empty contest_id or text", userID)
				return
			}
			log.Printf("[WS] User %d sending message to contest %s: %s", userID, msg.ContestID, msg.Text)
			_, err := h.service.CreateChatMessage(
				r.Context(),
				model.ContestID(msg.ContestID),
				userID,
				msg.Text,
			)
			if err != nil {
				log.Printf("[WS] ERROR: Failed to create chat message from user %d: %v", userID, err)
				return
			}
			log.Printf("[WS] Chat message created successfully by user %d", userID)
		default:
			log.Printf("[WS] WARNING: Unknown message type '%s' from user %d", msg.Type, userID)
		}
	})
}
