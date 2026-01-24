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
		uhttp.HandleError(w, uhttp.NewBadRequestError("participantId is required", nil))
		return
	}

	var req struct {
		PhotoIDs []string `json:"photo_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[UpdatePhotoOrderHandler] ERROR: Failed to decode request body: %v", err)
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	if len(req.PhotoIDs) == 0 {
		log.Printf("[UpdatePhotoOrderHandler] ERROR: photo_ids is required")
		uhttp.HandleError(w, uhttp.NewBadRequestError("photo_ids is required", nil))
		return
	}

	log.Printf("[UpdatePhotoOrderHandler] Updating photo order for participant %s, user %d", participantID, userID)
	if err := h.service.UpdateParticipantPhotoOrder(r.Context(), participantID, userID, req.PhotoIDs); err != nil {
		log.Printf("[UpdatePhotoOrderHandler] ERROR: Failed to update photo order: %v", err)
		uhttp.HandleError(w, err)
		return
	}

	type response struct {
		Success bool `json:"success"`
	}
	if err := uhttp.SendSuccess(w, response{Success: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
