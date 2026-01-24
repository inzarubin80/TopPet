package ws

import (
	"fmt"
	"log"
	"sync"

	"github.com/gorilla/websocket"
	"toppet/server/internal/model"
)

// Message is an internal hub message envelope sent to subscribers.
type Message struct {
	ContestID model.ContestID
	UserID    *model.UserID
	Payload   any
}

// Client represents a single WebSocket connection.
type Client struct {
	Conn     *websocket.Conn
	UserID   model.UserID
	Contests map[model.ContestID]struct{}
	Send     chan any
	Hub      *Hub
	mu       sync.RWMutex
	closedOnce sync.Once
}

// Hub manages WebSocket clients grouped by contestID.
type Hub struct {
	clientsByContest map[model.ContestID]map[*Client]struct{}
	register         chan *Client
	unregister       chan *Client
	broadcast        chan *Message
	mu               sync.RWMutex
}

// NewHub returns a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clientsByContest: make(map[model.ContestID]map[*Client]struct{}),
		register:         make(chan *Client),
		unregister:       make(chan *Client),
		broadcast:        make(chan *Message, 256),
	}
}

// Run starts the main event loop of the hub.
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.addClient(c)
		case c := <-h.unregister:
			h.removeClient(c)
		case msg := <-h.broadcast:
			h.dispatch(msg)
		}
	}
}

// RegisterClient registers a client with the hub.
func (h *Hub) RegisterClient(c *Client) {
	h.register <- c
}

// UnregisterClient unregisters a client from the hub.
func (h *Hub) UnregisterClient(c *Client) {
	h.unregister <- c
}

// Subscribe adds the client to a contest room.
func (c *Client) Subscribe(contestID model.ContestID) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.Contests == nil {
		c.Contests = make(map[model.ContestID]struct{})
	}
	if _, ok := c.Contests[contestID]; ok {
		log.Printf("[WS Hub] User %d already subscribed to contest %s", c.UserID, contestID)
		return
	}
	c.Contests[contestID] = struct{}{}

	c.Hub.mu.Lock()
	defer c.Hub.mu.Unlock()
	if _, ok := c.Hub.clientsByContest[contestID]; !ok {
		c.Hub.clientsByContest[contestID] = make(map[*Client]struct{})
		log.Printf("[WS Hub] Creating new room for contest %s", contestID)
	}
	c.Hub.clientsByContest[contestID][c] = struct{}{}
	log.Printf("[WS Hub] User %d subscribed to contest %s (total clients in room: %d)", c.UserID, contestID, len(c.Hub.clientsByContest[contestID]))
}

// Unsubscribe removes the client from a contest room.
func (c *Client) Unsubscribe(contestID model.ContestID) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.Contests, contestID)

	c.Hub.mu.Lock()
	defer c.Hub.mu.Unlock()
	if clients, ok := c.Hub.clientsByContest[contestID]; ok {
		delete(clients, c)
		log.Printf("[WS Hub] User %d unsubscribed from contest %s (remaining clients: %d)", c.UserID, contestID, len(clients))
		if len(clients) == 0 {
			delete(c.Hub.clientsByContest, contestID)
			log.Printf("[WS Hub] Contest %s has no more clients, removing from hub", contestID)
		}
	} else {
		log.Printf("[WS Hub] WARNING: User %d tried to unsubscribe from contest %s, but room doesn't exist", c.UserID, contestID)
	}
}

// Close closes the client connection and unregisters it.
func (c *Client) Close() {
	c.closedOnce.Do(func() {
		log.Printf("[WS Hub] Closing connection for user %d", c.UserID)
		c.Hub.UnregisterClient(c)
		close(c.Send)
		err := c.Conn.Close()
		if err != nil {
			log.Printf("[WS Hub] Error closing connection for user %d: %v", c.UserID, err)
		} else {
			log.Printf("[WS Hub] Connection closed successfully for user %d", c.UserID)
		}
	})
}

// ReadPump reads messages from the WebSocket connection and passes raw payloads
// to the provided callback for application-level handling.
func (c *Client) ReadPump(onMessage func(raw []byte)) {
	defer func() {
		log.Printf("[WS ReadPump] ReadPump ending for user %d, closing connection", c.UserID)
		c.Close()
	}()
	c.Conn.SetReadLimit(64 * 1024)
	log.Printf("[WS ReadPump] Starting ReadPump for user %d", c.UserID)
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS ReadPump] ERROR: Unexpected close error for user %d: %v", c.UserID, err)
			} else {
				log.Printf("[WS ReadPump] Connection closed for user %d: %v", c.UserID, err)
			}
			break
		}
		log.Printf("[WS ReadPump] Received raw message from user %d (length: %d bytes)", c.UserID, len(message))
		if onMessage != nil {
			onMessage(message)
		}
	}
}

// WritePump drains the send channel and writes JSON messages to the websocket.
func (c *Client) WritePump() {
	defer func() {
		log.Printf("[WS WritePump] WritePump ending for user %d, closing connection", c.UserID)
		c.Close()
	}()
	log.Printf("[WS WritePump] Starting WritePump for user %d", c.UserID)
	for msg := range c.Send {
		log.Printf("[WS WritePump] Sending message to user %d", c.UserID)
		if err := c.Conn.WriteJSON(msg); err != nil {
			log.Printf("[WS WritePump] ERROR: Failed to write message to user %d: %v", c.UserID, err)
			break
		}
		log.Printf("[WS WritePump] Message sent successfully to user %d", c.UserID)
	}
}

func (h *Hub) addClient(c *Client) {
	log.Printf("[WS Hub] Adding client for user %d (total clients will be tracked)", c.UserID)
	// initial registration does not subscribe to any contest yet
}

func (h *Hub) removeClient(c *Client) {
	c.mu.Lock()
	defer c.mu.Unlock()

	h.mu.Lock()
	defer h.mu.Unlock()

	contestCount := len(c.Contests)
	log.Printf("[WS Hub] Removing client for user %d (subscribed to %d contests)", c.UserID, contestCount)

	for contestID := range c.Contests {
		if clients, ok := h.clientsByContest[contestID]; ok {
			delete(clients, c)
			log.Printf("[WS Hub] User %d unsubscribed from contest %s (remaining clients: %d)", c.UserID, contestID, len(clients))
			if len(clients) == 0 {
				delete(h.clientsByContest, contestID)
				log.Printf("[WS Hub] Contest %s has no more clients, removing from hub", contestID)
			}
		}
	}
}

func (h *Hub) dispatch(msg *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clients, ok := h.clientsByContest[msg.ContestID]
	if !ok {
		log.Printf("[WS Hub] No clients subscribed to contest %s, message not dispatched", msg.ContestID)
		return
	}

	targetUserID := "all"
	if msg.UserID != nil {
		targetUserID = fmt.Sprintf("%d", *msg.UserID)
	}
	log.Printf("[WS Hub] Dispatching message to contest %s, target user: %s, total clients: %d", msg.ContestID, targetUserID, len(clients))

	sentCount := 0
	for c := range clients {
		// if UserID is set, send only to that user
		if msg.UserID != nil && c.UserID != *msg.UserID {
			log.Printf("[WS Hub] Skipping user %d (target is user %d)", c.UserID, *msg.UserID)
			continue
		}
		select {
		case c.Send <- msg.Payload:
			sentCount++
			log.Printf("[WS Hub] Message queued for user %d", c.UserID)
		default:
			// slow client, close
			log.Printf("[WS Hub] WARNING: Send channel full for user %d, closing connection", c.UserID)
			go c.Close()
		}
	}
	log.Printf("[WS Hub] Message dispatched to %d clients in contest %s", sentCount, msg.ContestID)
}

// BroadcastContestMessage sends a payload to all clients subscribed to the contest.
func (h *Hub) BroadcastContestMessage(contestID model.ContestID, payload any) error {
	log.Printf("[WS Hub] Broadcasting message to contest %s", contestID)
	select {
	case h.broadcast <- &Message{ContestID: contestID, Payload: payload}:
		log.Printf("[WS Hub] Broadcast message queued for contest %s", contestID)
	default:
		log.Printf("[WS Hub] ERROR: Broadcast channel full, dropping message for contest %s", contestID)
	}
	return nil
}

// SendContestMessageToUser sends a payload to a specific user within the contest room.
func (h *Hub) SendContestMessageToUser(contestID model.ContestID, userID model.UserID, payload any) error {
	select {
	case h.broadcast <- &Message{ContestID: contestID, UserID: &userID, Payload: payload}:
	default:
		log.Printf("ws hub broadcast channel full, dropping direct message for contest %s", contestID)
	}
	return nil
}
