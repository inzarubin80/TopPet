package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceGetContest interface {
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
	}

	GetContestHandler struct {
		name    string
		service serviceGetContest
	}
)

func NewGetContestHandler(name string, service serviceGetContest) *GetContestHandler {
	return &GetContestHandler{name: name, service: service}
}

func (h *GetContestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "contestId is required")
		return
	}

	contest, err := h.service.GetContest(r.Context(), contestID)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}

	jsonData, _ := json.Marshal(contest)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
