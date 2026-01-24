package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceVote interface {
		Vote(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) (*model.Vote, error)
		GetUserVote(ctx context.Context, contestID model.ContestID, userID model.UserID) (*model.Vote, error)
		Unvote(ctx context.Context, contestID model.ContestID, userID model.UserID) (model.ParticipantID, error)
	}

	VoteHandler struct {
		name    string
		service serviceVote
		authService serviceOptionalAuth
	}
)

func NewVoteHandler(name string, service serviceVote) *VoteHandler {
	var authService serviceOptionalAuth
	if svc, ok := service.(serviceOptionalAuth); ok {
		authService = svc
	}
	return &VoteHandler{name: name, service: service, authService: authService}
}

func (h *VoteHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	contestID := model.ContestID(r.PathValue("contestId"))

	if r.Method == http.MethodGet {
		// Get user vote (optional auth)
		userIDVal := r.Context().Value(defenitions.UserID)
		if userIDVal == nil {
			optionalUserID, hasUser, authErr := getOptionalUserID(r, h.authService)
			if authErr != nil || !hasUser {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			userIDVal = optionalUserID
		}
		userID := userIDVal.(model.UserID)
		vote, err := h.service.GetUserVote(r.Context(), contestID, userID)
		if err != nil {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		type resp struct {
			ParticipantID string `json:"participant_id"`
		}
		jsonData, _ := json.Marshal(resp{ParticipantID: string(vote.ParticipantID)})
		uhttp.SendSuccessfulResponse(w, jsonData)
		return
	}

	if r.Method == http.MethodDelete {
		userID := r.Context().Value(defenitions.UserID).(model.UserID)
		participantID, err := h.service.Unvote(r.Context(), contestID, userID)
		if err != nil {
			if errors.Is(err, model.ErrorNotFound) {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if participantID == "" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		type resp struct {
			ParticipantID string `json:"participant_id"`
		}
		jsonData, _ := json.Marshal(resp{ParticipantID: string(participantID)})
		uhttp.SendSuccessfulResponse(w, jsonData)
		return
	}

	// POST vote
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	var req struct {
		ParticipantID string `json:"participant_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	vote, err := h.service.Vote(r.Context(), contestID, model.ParticipantID(req.ParticipantID), userID)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	type resp struct {
		ParticipantID string `json:"participant_id"`
	}
	jsonData, _ := json.Marshal(resp{ParticipantID: string(vote.ParticipantID)})
	uhttp.SendSuccessfulResponse(w, jsonData)
}
