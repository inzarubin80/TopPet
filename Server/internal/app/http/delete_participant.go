package http

import (
	"context"
	"log"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceDeleteParticipant interface {
		DeleteParticipant(ctx context.Context, participantID model.ParticipantID, userID model.UserID) error
	}

	DeleteParticipantHandler struct {
		name    string
		service serviceDeleteParticipant
	}
)

func NewDeleteParticipantHandler(name string, service serviceDeleteParticipant) *DeleteParticipantHandler {
	return &DeleteParticipantHandler{name: name, service: service}
}

func (h *DeleteParticipantHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))
	
	if participantID == "" {
		log.Printf("[DeleteParticipantHandler] ERROR: participantId is required")
		uhttp.HandleError(w, uhttp.NewBadRequestError("participantId is required", nil))
		return
	}

	log.Printf("[DeleteParticipantHandler] Deleting participant %s for user %d", participantID, userID)

	err := h.service.DeleteParticipant(r.Context(), participantID, userID)
	if err != nil {
		log.Printf("[DeleteParticipantHandler] ERROR: Failed to delete participant: %v", err)
		uhttp.HandleError(w, err)
		return
	}

	log.Printf("[DeleteParticipantHandler] Participant deleted successfully: participantID=%s", participantID)
	type response struct {
		OK bool `json:"ok"`
	}
	if err := uhttp.SendSuccess(w, response{OK: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
