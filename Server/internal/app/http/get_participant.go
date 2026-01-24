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
	serviceGetParticipant interface {
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
		GetParticipantWithLikes(ctx context.Context, participantID model.ParticipantID, userID *model.UserID) (*model.Participant, error)
	}

	GetParticipantHandler struct {
		name        string
		service     serviceGetParticipant
		authService serviceOptionalAuth
	}
)

func NewGetParticipantHandler(name string, service serviceGetParticipant) *GetParticipantHandler {
	var authService serviceOptionalAuth
	if svc, ok := service.(serviceOptionalAuth); ok {
		authService = svc
	}
	return &GetParticipantHandler{name: name, service: service, authService: authService}
}

func (h *GetParticipantHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	participantID := model.ParticipantID(r.PathValue("participantId"))
	
	// Get userID from context or extract from token (optional auth)
	var userID *model.UserID
	if userIDVal := r.Context().Value(defenitions.UserID); userIDVal != nil {
		uid := userIDVal.(model.UserID)
		userID = &uid
	} else {
		// Try to get userID from token if available
		uid, ok, _ := getOptionalUserID(r, h.authService)
		if ok {
			userID = &uid
		}
	}
	
	var participant *model.Participant
	var err error
	if userID != nil {
		participant, err = h.service.GetParticipantWithLikes(r.Context(), participantID, userID)
	} else {
		participant, err = h.service.GetParticipant(r.Context(), participantID)
	}
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	
	jsonData, _ := json.Marshal(participant)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
