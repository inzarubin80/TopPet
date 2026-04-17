package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type juryScoresReportService interface {
	GetJuryScoresReportForParticipant(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, actorID model.UserID) ([]*model.JuryScoreReportItem, float64, error)
}

type JuryScoresReportHandler struct {
	name    string
	service juryScoresReportService
}

func NewJuryScoresReportHandler(name string, service juryScoresReportService) *JuryScoresReportHandler {
	return &JuryScoresReportHandler{name: name, service: service}
}

func (h *JuryScoresReportHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	actorID := r.Context().Value(defenitions.UserID).(model.UserID)
	items, total, err := h.service.GetJuryScoresReportForParticipant(r.Context(), contestID, participantID, actorID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{
		"items":              items,
		"total_jury_score":   total,
	})
}
