package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceListContests interface {
		ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error)
	}

	ListContestsHandler struct {
		name    string
		service serviceListContests
	}
)

func NewListContestsHandler(name string, service serviceListContests) *ListContestsHandler {
	return &ListContestsHandler{name: name, service: service}
}

func (h *ListContestsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	
	var status *model.ContestStatus
	if s := q.Get("status"); s != "" {
		cs := model.ContestStatus(s)
		status = &cs
	}

	limit := 20
	if l := q.Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	offset := 0
	if o := q.Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			offset = n
		}
	}

	contests, total, err := h.service.ListContests(r.Context(), status, limit, offset)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	type response struct {
		Items []*model.Contest `json:"items"`
		Total int64            `json:"total"`
	}

	resp := response{Items: contests, Total: total}
	jsonData, _ := json.Marshal(resp)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
