package http

import (
	"context"
	"errors"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type serviceMarkStaffCommentsRead interface {
	MarkParticipantStaffCommentsRead(ctx context.Context, participantID model.ParticipantID, userID model.UserID) error
}

type MarkStaffCommentsReadHandler struct {
	name    string
	service serviceMarkStaffCommentsRead
}

func NewMarkStaffCommentsReadHandler(name string, service serviceMarkStaffCommentsRead) *MarkStaffCommentsReadHandler {
	return &MarkStaffCommentsReadHandler{name: name, service: service}
}

func (h *MarkStaffCommentsReadHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))
	if participantID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("participantId is required", nil))
		return
	}
	if err := h.service.MarkParticipantStaffCommentsRead(r.Context(), participantID, userID); err != nil {
		if errors.Is(err, model.ErrorForbidden) {
			uhttp.HandleError(w, uhttp.NewForbiddenError("forbidden", nil))
			return
		}
		uhttp.HandleError(w, err)
		return
	}
	type response struct {
		OK bool `json:"ok"`
	}
	if err := uhttp.SendSuccess(w, response{OK: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
