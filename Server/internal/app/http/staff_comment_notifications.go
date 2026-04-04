package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type serviceStaffCommentNotifications interface {
	ListStaffCommentNotifications(ctx context.Context, userID model.UserID) ([]*model.StaffCommentNotification, int64, error)
}

type StaffCommentNotificationsHandler struct {
	name    string
	service serviceStaffCommentNotifications
}

func NewStaffCommentNotificationsHandler(name string, service serviceStaffCommentNotifications) *StaffCommentNotificationsHandler {
	return &StaffCommentNotificationsHandler{name: name, service: service}
}

func (h *StaffCommentNotificationsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	items, totalUnread, err := h.service.ListStaffCommentNotifications(r.Context(), userID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	type resp struct {
		Items       []*model.StaffCommentNotification `json:"items"`
		TotalUnread int64                             `json:"total_unread"`
	}
	if err := uhttp.SendSuccess(w, resp{Items: items, TotalUnread: totalUnread}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
