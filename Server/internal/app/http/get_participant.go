package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceGetParticipant interface {
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
	}

	GetParticipantHandler struct {
		name    string
		service serviceGetParticipant
	}
)

func NewGetParticipantHandler(name string, service serviceGetParticipant) *GetParticipantHandler {
	return &GetParticipantHandler{name: name, service: service}
}

func (h *GetParticipantHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	participantID := model.ParticipantID(r.PathValue("participantId"))
	participant, err := h.service.GetParticipant(r.Context(), participantID)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	jsonData, _ := json.Marshal(participant)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
