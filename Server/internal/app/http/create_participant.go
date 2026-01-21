package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceCreateParticipant interface {
		CreateParticipant(ctx context.Context, contestID model.ContestID, userID model.UserID, petName, petDescription string) (*model.Participant, error)
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

	var req struct {
		PetName        string `json:"pet_name"`
		PetDescription string `json:"pet_description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	participant, err := h.service.CreateParticipant(r.Context(), contestID, userID, req.PetName, req.PetDescription)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(participant)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
