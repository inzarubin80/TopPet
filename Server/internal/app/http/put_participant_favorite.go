package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type serviceSetParticipantFavorite interface {
	SetParticipantFavorite(ctx context.Context, contestID model.ContestID, participantID model.ParticipantID, userID model.UserID, favorite bool) error
}

type PutParticipantFavoriteHandler struct {
	name    string
	service serviceSetParticipantFavorite
}

func NewPutParticipantFavoriteHandler(name string, service serviceSetParticipantFavorite) *PutParticipantFavoriteHandler {
	return &PutParticipantFavoriteHandler{name: name, service: service}
}

func (h *PutParticipantFavoriteHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	participantID := model.ParticipantID(r.PathValue("participantId"))
	if contestID == "" || participantID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId and participantId are required", nil))
		return
	}

	var req struct {
		Favorite bool `json:"favorite"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	err := h.service.SetParticipantFavorite(r.Context(), contestID, participantID, userID, req.Favorite)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type resp struct {
		OK bool `json:"ok"`
	}
	if err := uhttp.SendSuccess(w, resp{OK: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
