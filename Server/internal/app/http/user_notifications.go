package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type serviceUserNotifications interface {
	ListUserNotifications(ctx context.Context, userID model.UserID, limit int32, cursorCreatedAt *time.Time, cursorID *model.UserNotificationID) ([]*model.UserNotification, int64, error)
	MarkUserNotificationRead(ctx context.Context, ownerUserID model.UserID, id model.UserNotificationID) (*model.UserNotification, error)
	MarkAllUserNotificationsRead(ctx context.Context, userID model.UserID) error
}

type UserNotificationsListHandler struct {
	name    string
	service serviceUserNotifications
}

func NewUserNotificationsListHandler(name string, service serviceUserNotifications) *UserNotificationsListHandler {
	return &UserNotificationsListHandler{name: name, service: service}
}

func (h *UserNotificationsListHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	limit := int32(50)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 32); err == nil && n > 0 {
			limit = int32(n)
		}
	}
	var cursorTime *time.Time
	var cursorID *model.UserNotificationID
	if ts := r.URL.Query().Get("cursor_created_at"); ts != "" {
		if id := r.URL.Query().Get("cursor_id"); id != "" {
			t, err := time.Parse(time.RFC3339Nano, ts)
			if err != nil {
				t, err = time.Parse(time.RFC3339, ts)
			}
			if err == nil {
				cursorTime = &t
				nid := model.UserNotificationID(id)
				cursorID = &nid
			}
		}
	}
	items, totalUnread, err := h.service.ListUserNotifications(r.Context(), userID, limit, cursorTime, cursorID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	type resp struct {
		Items       []*model.UserNotification `json:"items"`
		TotalUnread int64                     `json:"total_unread"`
	}
	if err := uhttp.SendSuccess(w, resp{Items: items, TotalUnread: totalUnread}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

type patchUserNotificationBody struct {
	Read bool `json:"read"`
}

type UserNotificationPatchHandler struct {
	name    string
	service serviceUserNotifications
}

func NewUserNotificationPatchHandler(name string, service serviceUserNotifications) *UserNotificationPatchHandler {
	return &UserNotificationPatchHandler{name: name, service: service}
}

func (h *UserNotificationPatchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	id := model.UserNotificationID(r.PathValue("notificationId"))
	var body patchUserNotificationBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	if !body.Read {
		uhttp.HandleError(w, uhttp.NewBadRequestError("read must be true", nil))
		return
	}
	updated, err := h.service.MarkUserNotificationRead(r.Context(), userID, id)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	if err := uhttp.SendSuccess(w, updated); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

type UserNotificationsReadAllHandler struct {
	name    string
	service serviceUserNotifications
}

func NewUserNotificationsReadAllHandler(name string, service serviceUserNotifications) *UserNotificationsReadAllHandler {
	return &UserNotificationsReadAllHandler{name: name, service: service}
}

func (h *UserNotificationsReadAllHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	if err := h.service.MarkAllUserNotificationsRead(r.Context(), userID); err != nil {
		uhttp.HandleError(w, err)
		return
	}
	if err := uhttp.SendSuccess(w, map[string]bool{"ok": true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
