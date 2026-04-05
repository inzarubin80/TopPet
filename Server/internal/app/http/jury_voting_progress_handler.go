package http

import (
	"context"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type juryVotingProgressService interface {
	GetJuryVotingProgressReportForContest(ctx context.Context, contestID model.ContestID, actorID model.UserID) ([]*model.JuryVotingProgressRow, int64, int64, error)
}

type JuryVotingProgressHandler struct {
	name    string
	service juryVotingProgressService
}

func NewJuryVotingProgressHandler(name string, service juryVotingProgressService) *JuryVotingProgressHandler {
	return &JuryVotingProgressHandler{name: name, service: service}
}

func (h *JuryVotingProgressHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}
	actorID := r.Context().Value(defenitions.UserID).(model.UserID)
	rows, criteriaTotal, juryMemberCount, err := h.service.GetJuryVotingProgressReportForContest(r.Context(), contestID, actorID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{
		"rows":               rows,
		"criteria_total":     criteriaTotal,
		"jury_member_count":  juryMemberCount,
	})
}
