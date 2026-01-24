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
	serviceDeletePhoto interface {
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
		DeleteParticipantPhoto(ctx context.Context, participantID model.ParticipantID, photoID string, userID model.UserID) error
	}

	DeletePhotoHandler struct {
		name    string
		service serviceDeletePhoto
	}
)

func NewDeletePhotoHandler(name string, service serviceDeletePhoto) *DeletePhotoHandler {
	return &DeletePhotoHandler{name: name, service: service}
}

func (h *DeletePhotoHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))
	photoID := r.PathValue("photoId")

	if participantID == "" {
		log.Printf("[DeletePhotoHandler] ERROR: participantId is required")
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "participantId is required")
		return
	}

	if photoID == "" {
		log.Printf("[DeletePhotoHandler] ERROR: photoId is required")
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "photoId is required")
		return
	}

	log.Printf("[DeletePhotoHandler] Deleting photo %s for participant %s, user %d", photoID, participantID, userID)

	err := h.service.DeleteParticipantPhoto(r.Context(), participantID, photoID, userID)
	if err != nil {
		log.Printf("[DeletePhotoHandler] ERROR: Failed to delete photo: %v", err)
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	log.Printf("[DeletePhotoHandler] Photo deleted successfully: photoID=%s", photoID)
	uhttp.SendSuccessfulResponse(w, []byte(`{"success": true}`))
}
