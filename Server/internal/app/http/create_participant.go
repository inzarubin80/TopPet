package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/logger"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceCreateParticipant interface {
		CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, entryTitle, entryDescription string, registrationAnswers map[string]interface{}, nominationID *string) (*model.Participant, error)
	}

	CreateParticipantHandler struct {
		name    string
		service serviceCreateParticipant
	}
)

func NewCreateParticipantHandler(name string, service serviceCreateParticipant) *CreateParticipantHandler {
	return &CreateParticipantHandler{name: name, service: service}
}

func (h *CreateParticipantHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))

	logger.Info("Creating participant", "handler", "CreateParticipantHandler", "contestID", contestID, "userID", userID)

	var req struct {
		EntryTitle          string                 `json:"entry_title"`
		EntryDescription    string                 `json:"entry_description"`
		PetName             string                 `json:"pet_name"`
		PetDescription      string                 `json:"pet_description"`
		RegistrationAnswers map[string]interface{} `json:"registration_answers"`
		NominationID        *string                `json:"nomination_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("Failed to decode request body", "handler", "CreateParticipantHandler", "error", err)
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	entryTitle := req.EntryTitle
	if entryTitle == "" {
		entryTitle = req.PetName
	}
	entryDescription := req.EntryDescription
	if entryDescription == "" {
		entryDescription = req.PetDescription
	}
	logger.Debug("Request data", "handler", "CreateParticipantHandler", "entry_title", entryTitle, "entry_description", entryDescription)

	participant, err := h.service.CreateParticipant(r.Context(), contestID, userID, entryTitle, entryDescription, req.RegistrationAnswers, req.NominationID)
	if err != nil {
		logger.Error("Failed to create participant", "handler", "CreateParticipantHandler", "error", err)
		uhttp.HandleError(w, err)
		return
	}

	logger.Info("Participant created successfully", "handler", "CreateParticipantHandler", "participantID", participant.ID)
	if err := uhttp.SendSuccess(w, participant); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
