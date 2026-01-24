package http

import (
	"context"
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
		name        string
		service     serviceListContests
		authService serviceOptionalAuth
	}
)

func NewListContestsHandler(name string, service serviceListContests) *ListContestsHandler {
	var authService serviceOptionalAuth
	if svc, ok := service.(serviceOptionalAuth); ok {
		authService = svc
	}

	return &ListContestsHandler{name: name, service: service, authService: authService}
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

	userID, hasUser, authErr := getOptionalUserID(r, h.authService)
	if authErr != nil {
		uhttp.HandleError(w, uhttp.NewUnauthorizedError("authentication error", authErr))
		return
	}

	contests, total, err := h.service.ListContests(r.Context(), status, limit, offset)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	filtered := make([]*model.Contest, 0, len(contests))
	for _, contest := range contests {
		if contest.Status != model.ContestStatusDraft {
			filtered = append(filtered, contest)
			continue
		}
		if hasUser && contest.CreatedByUserID == userID {
			filtered = append(filtered, contest)
		}
	}

	type response struct {
		Items []*model.Contest `json:"items"`
		Total int64            `json:"total"`
	}

	resp := response{Items: filtered, Total: int64(len(filtered))}
	if status != nil && *status != model.ContestStatusDraft {
		resp.Total = total
	}
	if err := uhttp.SendSuccess(w, resp); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
