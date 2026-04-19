package ws

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
	"toppet/server/internal/model"
)

// UserNotificationClient — одно WS-подключение, привязанное к пользователю (все конкурсы).
type UserNotificationClient struct {
	Conn   *websocket.Conn
	UserID model.UserID
	Send   chan any
	Hub    *UserHub
	closedOnce sync.Once
}

// UserHub доставляет события всем сокетам данного user_id (несколько вкладок).
type UserHub struct {
	clientsByUser map[model.UserID]map[*UserNotificationClient]struct{}
	register      chan *UserNotificationClient
	unregister    chan *UserNotificationClient
	broadcast     chan *userNotificationMessage
	mu            sync.RWMutex
}

type userNotificationMessage struct {
	UserID  model.UserID
	Payload any
}

// NewUserHub создаёт хаб пользовательских уведомлений.
func NewUserHub() *UserHub {
	return &UserHub{
		clientsByUser: make(map[model.UserID]map[*UserNotificationClient]struct{}),
		register:      make(chan *UserNotificationClient),
		unregister:    make(chan *UserNotificationClient),
		broadcast:     make(chan *userNotificationMessage, 256),
	}
}

// Run — основной цикл (как у Hub конкурсного чата).
func (h *UserHub) Run() {
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

// RegisterUserClient регистрирует клиента (после upgrade).
func (h *UserHub) RegisterUserClient(c *UserNotificationClient) {
	h.register <- c
}

// UnregisterUserClient снимает регистрацию.
func (h *UserHub) UnregisterUserClient(c *UserNotificationClient) {
	h.unregister <- c
}

// SendToUser ставит в очередь payload всем сокетам пользователя.
func (h *UserHub) SendToUser(userID model.UserID, payload any) error {
	select {
	case h.broadcast <- &userNotificationMessage{UserID: userID, Payload: payload}:
	default:
		log.Printf("[UserHub] broadcast channel full, dropping notification for user %d", userID)
	}
	return nil
}

func (h *UserHub) addClient(c *UserNotificationClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clientsByUser[c.UserID]; !ok {
		h.clientsByUser[c.UserID] = make(map[*UserNotificationClient]struct{})
	}
	h.clientsByUser[c.UserID][c] = struct{}{}
	log.Printf("[UserHub] user %d connected (sockets: %d)", c.UserID, len(h.clientsByUser[c.UserID]))
}

func (h *UserHub) removeClient(c *UserNotificationClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.clientsByUser[c.UserID]; ok {
		delete(clients, c)
		remaining := len(clients)
		if remaining == 0 {
			delete(h.clientsByUser, c.UserID)
		}
		log.Printf("[UserHub] user %d disconnected (remaining sockets: %d)", c.UserID, remaining)
	}
}

func (h *UserHub) dispatch(msg *userNotificationMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients, ok := h.clientsByUser[msg.UserID]
	if !ok {
		log.Printf("[UserHub] no sockets for user %d, notification not pushed", msg.UserID)
		return
	}
	for c := range clients {
		select {
		case c.Send <- msg.Payload:
		default:
			log.Printf("[UserHub] send queue full for user %d, closing slow client", c.UserID)
			go c.Close()
		}
	}
}

// Close закрывает соединение.
func (c *UserNotificationClient) Close() {
	c.closedOnce.Do(func() {
		c.Hub.UnregisterUserClient(c)
		close(c.Send)
		_ = c.Conn.Close()
	})
}

// ReadPump читает входящие кадры (клиент может слать ping или пустые сообщения).
func (c *UserNotificationClient) ReadPump(onMessage func(raw []byte)) {
	defer c.Close()
	c.Conn.SetReadLimit(64 * 1024)
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[UserNotification WS] unexpected close user %d: %v", c.UserID, err)
			}
			break
		}
		if onMessage != nil {
			onMessage(message)
		}
	}
}

// WritePump отправляет JSON в сокет.
func (c *UserNotificationClient) WritePump() {
	defer c.Close()
	for msg := range c.Send {
		if err := c.Conn.WriteJSON(msg); err != nil {
			log.Printf("[UserNotification WS] write failed user %d: %v", c.UserID, err)
			break
		}
	}
}
