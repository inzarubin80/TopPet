package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceParticipantVoters interface {
		ListVotersForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID) ([]*model.VoterInfo, error)
	}

	ParticipantVotersHandler struct {
		name    string
		service serviceParticipantVoters
	}
)

func NewParticipantVotersHandler(name string, service serviceParticipantVoters) *ParticipantVotersHandler {
	return &ParticipantVotersHandler{name: name, service: service}
}

func (h *ParticipantVotersHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	contestID := model.ContestID(r.PathValue("contestId"))
	participantID := model.ParticipantID(r.PathValue("participantId"))
	if contestID == "" || participantID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId and participantId are required", nil))
		return
	}

	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	voters, err := h.service.ListVotersForParticipant(r.Context(), contestID, participantID, userID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type resp struct {
		Voters []*model.VoterInfo `json:"voters"`
	}
	if err := uhttp.SendSuccess(w, resp{Voters: voters}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
