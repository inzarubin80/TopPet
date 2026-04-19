package http

import (
	"context"
	"log"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	wsapp "toppet/server/internal/app/ws"
	"toppet/server/internal/model"

)

type serviceUserNotificationsWS interface {
	CountUnreadUserNotifications(ctx context.Context, userID model.UserID) (int64, error)
}

type UserNotificationsWSHandler struct {
	name    string
	service serviceUserNotificationsWS
	auth    serviceAuth
	hub     *wsapp.UserHub
}

func NewUserNotificationsWSHandler(name string, svc serviceUserNotificationsWS, authSvc serviceAuth, hub *wsapp.UserHub) *UserNotificationsWSHandler {
	return &UserNotificationsWSHandler{name: name, service: svc, auth: authSvc, hub: hub}
}

func (h *UserNotificationsWSHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var userID model.UserID
	userIDVal := r.Context().Value(defenitions.UserID)
	if userIDVal != nil {
		userID = userIDVal.(model.UserID)
	} else {
		accessToken := r.URL.Query().Get("accessToken")
		if accessToken == "" {
			authHeader := r.Header.Get("Authorization")
			if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
				accessToken = authHeader[7:]
			}
		}
		if accessToken == "" {
			uhttp.HandleError(w, uhttp.NewUnauthorizedError("access token is required", nil))
			return
		}
		claims, err := h.auth.Authorization(r.Context(), accessToken)
		if err != nil {
			uhttp.HandleError(w, uhttp.NewUnauthorizedError("invalid access token", err))
			return
		}
		userID = claims.UserID
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[UserNotifications WS] upgrade failed: %v", err)
		return
	}

	client := &wsapp.UserNotificationClient{
		Conn:   conn,
		UserID: userID,
		Send:   make(chan any, 32),
		Hub:    h.hub,
	}
	h.hub.RegisterUserClient(client)

	totalUnread, _ := h.service.CountUnreadUserNotifications(r.Context(), userID)
	snapshot := wsapp.NotificationUnreadSnapshot{
		Type:        wsapp.MessageTypeNotificationUnread,
		TotalUnread: totalUnread,
	}
	select {
	case client.Send <- snapshot:
	default:
		log.Printf("[UserNotifications WS] slow client user %d, dropping snapshot", userID)
	}

	go client.WritePump()
	client.ReadPump(nil)
}
