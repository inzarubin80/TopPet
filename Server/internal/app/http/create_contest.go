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
	serviceCreateContest interface {
		CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
	}

	CreateContestHandler struct {
		name    string
		service serviceCreateContest
	}
)

func NewCreateContestHandler(name string, service serviceCreateContest) *CreateContestHandler {
	return &CreateContestHandler{name: name, service: service}
}

func (h *CreateContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	contest, err := h.service.CreateContest(r.Context(), userID, req.Title, req.Description)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(contest)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
