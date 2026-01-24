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
	serviceDeleteVideo interface {
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
		DeleteParticipantVideo(ctx context.Context, participantID model.ParticipantID, userID model.UserID) error
	}

	DeleteVideoHandler struct {
		name    string
		service serviceDeleteVideo
	}
)

func NewDeleteVideoHandler(name string, service serviceDeleteVideo) *DeleteVideoHandler {
	return &DeleteVideoHandler{name: name, service: service}
}

func (h *DeleteVideoHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))

	if participantID == "" {
		log.Printf("[DeleteVideoHandler] ERROR: participantId is required")
		uhttp.HandleError(w, uhttp.NewBadRequestError("participantId is required", nil))
		return
	}

	log.Printf("[DeleteVideoHandler] Deleting video for participant %s, user %d", participantID, userID)

	err := h.service.DeleteParticipantVideo(r.Context(), participantID, userID)
	if err != nil {
		log.Printf("[DeleteVideoHandler] ERROR: Failed to delete video: %v", err)
		uhttp.HandleError(w, err)
		return
	}

	log.Printf("[DeleteVideoHandler] Video deleted successfully: participantID=%s", participantID)
	type response struct {
		Success bool `json:"success"`
	}
	if err := uhttp.SendSuccess(w, response{Success: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
