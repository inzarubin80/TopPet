package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type juryScoresService interface {
	GetMyJuryScoresForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, jurorID model.UserID) ([]*model.JuryScore, error)
	PutMyJuryScoresForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, jurorID model.UserID, items []model.JuryScorePutItem) ([]*model.JuryScore, error)
}

type MyJuryScoresHandler struct {
	name    string
	service juryScoresService
}

func NewMyJuryScoresHandler(name string, service juryScoresService) *MyJuryScoresHandler {
	return &MyJuryScoresHandler{name: name, service: service}
}

func (h *MyJuryScoresHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	contestID := model.ContestID(r.PathValue("contestId"))
	participantID := model.ParticipantID(r.PathValue("participantId"))
	if contestID == "" || participantID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId and participantId are required", nil))
		return
	}
	jurorID := r.Context().Value(defenitions.UserID).(model.UserID)

	switch r.Method {
	case http.MethodGet:
		items, err := h.service.GetMyJuryScoresForParticipant(r.Context(), contestID, participantID, jurorID)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
	case http.MethodPut:
		var body struct {
			Items []model.JuryScorePutItem `json:"items"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
			return
		}
		items, err := h.service.PutMyJuryScoresForParticipant(r.Context(), contestID, participantID, jurorID, body.Items)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
	default:
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
	}
}
