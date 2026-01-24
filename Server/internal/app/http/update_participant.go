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
	serviceUpdateParticipant interface {
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
		UpdateParticipant(ctx context.Context, participantID model.ParticipantID, userID model.UserID, petName, petDescription string) (*model.Participant, error)
	}

	UpdateParticipantHandler struct {
		name    string
		service serviceUpdateParticipant
	}
)

func NewUpdateParticipantHandler(name string, service serviceUpdateParticipant) *UpdateParticipantHandler {
	return &UpdateParticipantHandler{name: name, service: service}
}

func (h *UpdateParticipantHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))
	
	if participantID == "" {
		log.Printf("[UpdateParticipantHandler] ERROR: participantId is required")
		uhttp.HandleError(w, uhttp.NewBadRequestError("participantId is required", nil))
		return
	}

	log.Printf("[UpdateParticipantHandler] Updating participant %s for user %d", participantID, userID)

	var req struct {
		PetName        *string `json:"pet_name"`
		PetDescription *string `json:"pet_description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[UpdateParticipantHandler] ERROR: Failed to decode request body: %v", err)
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	// Get current participant to get existing values
	// We'll need to get participant first to know current values
	// For now, we'll require both fields or get them from service
	// Actually, service should handle getting current values if fields are empty
	// Let's require at least one field to be provided
	if req.PetName == nil && req.PetDescription == nil {
		log.Printf("[UpdateParticipantHandler] ERROR: At least one field (pet_name or pet_description) must be provided")
		uhttp.HandleError(w, uhttp.NewBadRequestError("at least one field must be provided", nil))
		return
	}

	// Get current participant to merge with new values
	currentParticipant, err := h.service.GetParticipant(r.Context(), participantID)
	if err != nil {
		log.Printf("[UpdateParticipantHandler] ERROR: Failed to get current participant: %v", err)
		uhttp.HandleError(w, err)
		return
	}

	// Merge with new values (use current values if not provided)
	petName := currentParticipant.PetName
	petDescription := currentParticipant.PetDescription
	
	if req.PetName != nil && *req.PetName != "" {
		petName = *req.PetName
	}
	if req.PetDescription != nil {
		petDescription = *req.PetDescription
	}

	// Require pet_name to be non-empty
	if petName == "" {
		log.Printf("[UpdateParticipantHandler] ERROR: pet_name cannot be empty")
		uhttp.HandleError(w, uhttp.NewBadRequestError("pet_name cannot be empty", nil))
		return
	}

	log.Printf("[UpdateParticipantHandler] Request data: pet_name=%s, pet_description=%s", petName, petDescription)

	participant, err := h.service.UpdateParticipant(r.Context(), participantID, userID, petName, petDescription)
	if err != nil {
		log.Printf("[UpdateParticipantHandler] ERROR: Failed to update participant: %v", err)
		uhttp.HandleError(w, err)
		return
	}

	log.Printf("[UpdateParticipantHandler] Participant updated successfully: participantID=%s", participant.ID)
	if err := uhttp.SendSuccess(w, participant); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
