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
		uhttp.HandleError(w, uhttp.NewBadRequestError("participantId is required", nil))
		return
	}

	if photoID == "" {
		log.Printf("[DeletePhotoHandler] ERROR: photoId is required")
		uhttp.HandleError(w, uhttp.NewBadRequestError("photoId is required", nil))
		return
	}

	log.Printf("[DeletePhotoHandler] Deleting photo %s for participant %s, user %d", photoID, participantID, userID)

	err := h.service.DeleteParticipantPhoto(r.Context(), participantID, photoID, userID)
	if err != nil {
		log.Printf("[DeletePhotoHandler] ERROR: Failed to delete photo: %v", err)
		uhttp.HandleError(w, err)
		return
	}

	log.Printf("[DeletePhotoHandler] Photo deleted successfully: photoID=%s", photoID)
	type response struct {
		Success bool `json:"success"`
	}
	if err := uhttp.SendSuccess(w, response{Success: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
