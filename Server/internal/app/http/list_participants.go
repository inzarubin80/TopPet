package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceListParticipants interface {
		ListParticipantsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Participant, error)
	}

	ListParticipantsHandler struct {
		name    string
		service serviceListParticipants
	}
)

func NewListParticipantsHandler(name string, service serviceListParticipants) *ListParticipantsHandler {
	return &ListParticipantsHandler{name: name, service: service}
}

func (h *ListParticipantsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}

	participants, err := h.service.ListParticipantsByContest(r.Context(), contestID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type resp struct {
		Items []*model.Participant `json:"items"`
		Total int64               `json:"total"`
	}

	respData := resp{
		Items: participants,
		Total: int64(len(participants)),
	}

	if err := uhttp.SendSuccess(w, respData); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
