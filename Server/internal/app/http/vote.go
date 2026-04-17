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
		ListUserVotesForContest(ctx context.Context, contestID model.ContestID, userID model.UserID) ([]*model.Vote, error)
		Unvote(ctx context.Context, contestID model.ContestID, userID model.UserID, participantID model.ParticipantID) (model.ParticipantID, error)
	}

	VoteHandler struct {
		name        string
		service     serviceVote
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
		votes, err := h.service.ListUserVotesForContest(r.Context(), contestID, userID)
		if err != nil {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		type voteItem struct {
			ParticipantID string  `json:"participant_id"`
			NominationID  *string `json:"nomination_id,omitempty"`
		}
		items := make([]voteItem, 0, len(votes))
		for _, v := range votes {
			items = append(items, voteItem{
				ParticipantID: string(v.ParticipantID),
				NominationID:  v.NominationID,
			})
		}
		type resp struct {
			Votes []voteItem `json:"votes"`
		}
		if err := uhttp.SendSuccess(w, resp{Votes: items}); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
		return
	}

	if r.Method == http.MethodDelete {
		userID := r.Context().Value(defenitions.UserID).(model.UserID)
		pid := model.ParticipantID(r.URL.Query().Get("participant_id"))
		if pid == "" {
			uhttp.HandleError(w, uhttp.NewBadRequestError("participant_id is required", nil))
			return
		}
		participantID, err := h.service.Unvote(r.Context(), contestID, userID, pid)
		if err != nil {
			if errors.Is(err, model.ErrorNotFound) {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			uhttp.HandleError(w, err)
			return
		}
		if participantID == "" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		type resp struct {
			ParticipantID string `json:"participant_id"`
		}
		if err := uhttp.SendSuccess(w, resp{ParticipantID: string(participantID)}); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
		return
	}

	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	var req struct {
		ParticipantID string `json:"participant_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	vote, err := h.service.Vote(r.Context(), contestID, model.ParticipantID(req.ParticipantID), userID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type resp struct {
		ParticipantID string  `json:"participant_id"`
		NominationID  *string `json:"nomination_id,omitempty"`
	}
	if err := uhttp.SendSuccess(w, resp{
		ParticipantID: string(vote.ParticipantID),
		NominationID:  vote.NominationID,
	}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
