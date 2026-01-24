package http

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceUpdatePhotoOrder interface {
		UpdateParticipantPhotoOrder(ctx context.Context, participantID model.ParticipantID, userID model.UserID, photoIDs []string) error
	}

	UpdatePhotoOrderHandler struct {
		name    string
		service serviceUpdatePhotoOrder
	}
)

func NewUpdatePhotoOrderHandler(name string, service serviceUpdatePhotoOrder) *UpdatePhotoOrderHandler {
	return &UpdatePhotoOrderHandler{name: name, service: service}
}

func (h *UpdatePhotoOrderHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))

	if participantID == "" {
		log.Printf("[UpdatePhotoOrderHandler] ERROR: participantId is required")
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "participantId is required")
		return
	}

	var req struct {
		PhotoIDs []string `json:"photo_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[UpdatePhotoOrderHandler] ERROR: Failed to decode request body: %v", err)
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	if len(req.PhotoIDs) == 0 {
		log.Printf("[UpdatePhotoOrderHandler] ERROR: photo_ids is required")
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "photo_ids is required")
		return
	}

	log.Printf("[UpdatePhotoOrderHandler] Updating photo order for participant %s, user %d", participantID, userID)
	if err := h.service.UpdateParticipantPhotoOrder(r.Context(), participantID, userID, req.PhotoIDs); err != nil {
		log.Printf("[UpdatePhotoOrderHandler] ERROR: Failed to update photo order: %v", err)
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	uhttp.SendSuccessfulResponse(w, []byte(`{"success": true}`))
}
