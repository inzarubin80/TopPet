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
		GetParticipant(ctx context.Context, participantID model.ParticipantID, viewer *model.UserID) (*model.Participant, error)
		UpdateParticipant(ctx context.Context, participantID model.ParticipantID, userID model.UserID, entryTitle, entryDescription string, registrationAnswers *map[string]interface{}) (*model.Participant, error)
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
		EntryTitle          *string                 `json:"entry_title"`
		EntryDescription    *string                 `json:"entry_description"`
		PetName             *string                 `json:"pet_name"`
		PetDescription      *string                 `json:"pet_description"`
		RegistrationAnswers *map[string]interface{} `json:"registration_answers"`
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
	if req.EntryTitle == nil && req.EntryDescription == nil && req.PetName == nil && req.PetDescription == nil && req.RegistrationAnswers == nil {
		log.Printf("[UpdateParticipantHandler] ERROR: At least one field must be provided")
		uhttp.HandleError(w, uhttp.NewBadRequestError("at least one field must be provided", nil))
		return
	}

	// Get current participant to merge with new values
	currentParticipant, err := h.service.GetParticipant(r.Context(), participantID, &userID)
	if err != nil {
		log.Printf("[UpdateParticipantHandler] ERROR: Failed to get current participant: %v", err)
		uhttp.HandleError(w, err)
		return
	}

	// Merge with new values (use current values if not provided)
	entryTitle := currentParticipant.EntryTitle
	if entryTitle == "" {
		entryTitle = currentParticipant.PetName
	}
	entryDescription := currentParticipant.EntryDescription
	if entryDescription == "" {
		entryDescription = currentParticipant.PetDescription
	}

	if req.EntryTitle != nil && *req.EntryTitle != "" {
		entryTitle = *req.EntryTitle
	} else if req.PetName != nil && *req.PetName != "" {
		entryTitle = *req.PetName
	}
	if req.EntryDescription != nil {
		entryDescription = *req.EntryDescription
	} else if req.PetDescription != nil {
		entryDescription = *req.PetDescription
	}

	log.Printf("[UpdateParticipantHandler] Request data: entry_title=%s, entry_description=%s", entryTitle, entryDescription)

	participant, err := h.service.UpdateParticipant(r.Context(), participantID, userID, entryTitle, entryDescription, req.RegistrationAnswers)
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
