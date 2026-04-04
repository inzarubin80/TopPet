package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceGetParticipant interface {
		GetParticipantWithLikes(ctx context.Context, participantID model.ParticipantID, viewer *model.UserID) (*model.Participant, error)
	}

	GetParticipantHandler struct {
		name        string
		service     serviceGetParticipant
		authService serviceOptionalAuth
	}
)

func NewGetParticipantHandler(name string, service serviceGetParticipant) *GetParticipantHandler {
	var authService serviceOptionalAuth
	if svc, ok := service.(serviceOptionalAuth); ok {
		authService = svc
	}
	return &GetParticipantHandler{name: name, service: service, authService: authService}
}

func (h *GetParticipantHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	participantID := model.ParticipantID(r.PathValue("participantId"))

	var viewer *model.UserID
	if userIDVal := r.Context().Value(defenitions.UserID); userIDVal != nil {
		uid := userIDVal.(model.UserID)
		viewer = &uid
	} else if h.authService != nil {
		uid, ok, authErr := getOptionalUserID(r, h.authService)
		if authErr != nil {
			uhttp.HandleError(w, uhttp.NewUnauthorizedError("authentication error", authErr))
			return
		}
		if ok {
			viewer = &uid
		}
	}

	participant, err := h.service.GetParticipantWithLikes(r.Context(), participantID, viewer)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	
	if err := uhttp.SendSuccess(w, participant); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
