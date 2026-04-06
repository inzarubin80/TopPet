package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type juryService interface {
	ListContestJury(ctx context.Context, contestID model.ContestID) ([]*model.JuryMember, error)
	AddContestJuryMember(ctx context.Context, contestID model.ContestID, adminID model.UserID, memberUserID model.UserID) (*model.JuryMember, error)
	PatchContestJuryMember(ctx context.Context, contestID model.ContestID, adminID model.UserID, memberUserID model.UserID, patch model.JuryMemberPatch) (*model.JuryMember, error)
	ReorderContestJuryMembers(ctx context.Context, contestID model.ContestID, adminID model.UserID, orderedUserIDs []model.UserID) error
	RemoveContestJuryMember(ctx context.Context, contestID model.ContestID, adminID model.UserID, memberUserID model.UserID) error
}

type ContestJuryListHandler struct {
	name    string
	service juryService
}

func NewContestJuryListHandler(name string, service juryService) *ContestJuryListHandler {
	return &ContestJuryListHandler{name: name, service: service}
}

func (h *ContestJuryListHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	items, err := h.service.ListContestJury(r.Context(), contestID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
}

type ContestJuryAddHandler struct {
	name    string
	service juryService
}

func NewContestJuryAddHandler(name string, service juryService) *ContestJuryAddHandler {
	return &ContestJuryAddHandler{name: name, service: service}
}

func (h *ContestJuryAddHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	adminID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	var body struct {
		UserID model.UserID `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	if body.UserID == 0 {
		uhttp.HandleError(w, uhttp.NewBadRequestError("user_id is required", nil))
		return
	}
	m, err := h.service.AddContestJuryMember(r.Context(), contestID, adminID, body.UserID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, m)
}

type ContestJuryRemoveHandler struct {
	name    string
	service juryService
}

func NewContestJuryRemoveHandler(name string, service juryService) *ContestJuryRemoveHandler {
	return &ContestJuryRemoveHandler{name: name, service: service}
}

func (h *ContestJuryRemoveHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	adminID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	uidStr := r.PathValue("userId")
	uid, err := strconv.ParseInt(uidStr, 10, 64)
	if err != nil || uid < 1 {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid userId", err))
		return
	}
	if err := h.service.RemoveContestJuryMember(r.Context(), contestID, adminID, model.UserID(uid)); err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]bool{"ok": true})
}

type ContestJuryPatchHandler struct {
	name    string
	service juryService
}

func NewContestJuryPatchHandler(name string, service juryService) *ContestJuryPatchHandler {
	return &ContestJuryPatchHandler{name: name, service: service}
}

func (h *ContestJuryPatchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	adminID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	uidStr := r.PathValue("userId")
	uid, err := strconv.ParseInt(uidStr, 10, 64)
	if err != nil || uid < 1 {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid userId", err))
		return
	}
	var patch model.JuryMemberPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	m, err := h.service.PatchContestJuryMember(r.Context(), contestID, adminID, model.UserID(uid), patch)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, m)
}

type ContestJuryReorderHandler struct {
	name    string
	service juryService
}

func NewContestJuryReorderHandler(name string, service juryService) *ContestJuryReorderHandler {
	return &ContestJuryReorderHandler{name: name, service: service}
}

func (h *ContestJuryReorderHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	adminID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	var body struct {
		UserIDs []model.UserID `json:"user_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	if err := h.service.ReorderContestJuryMembers(r.Context(), contestID, adminID, body.UserIDs); err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]bool{"ok": true})
}

type userSearchService interface {
	SearchUsers(ctx context.Context, q string, limit int) ([]*model.UserSearchHit, error)
}

type UsersSearchHandler struct {
	name    string
	service userSearchService
}

func NewUsersSearchHandler(name string, service userSearchService) *UsersSearchHandler {
	return &UsersSearchHandler{name: name, service: service}
}

func (h *UsersSearchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	q := r.URL.Query().Get("q")
	limit := 20
	if ls := r.URL.Query().Get("limit"); ls != "" {
		if n, err := strconv.Atoi(ls); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}
	items, err := h.service.SearchUsers(r.Context(), q, limit)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
}
