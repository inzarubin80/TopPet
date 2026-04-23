package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	serviceAdminUsers interface {
		ListUsersForSystemAdmin(ctx context.Context, actorID model.UserID, limit, offset int) ([]*model.AdminUserListItem, int64, error)
		PatchUserBySystemAdmin(ctx context.Context, actorID model.UserID, targetUserID model.UserID, role *string, blocked *bool) (*model.User, error)
	}

	AdminUsersListHandler struct {
		name    string
		service serviceAdminUsers
	}

	AdminUserPatchHandler struct {
		name    string
		service serviceAdminUsers
	}
)

func NewAdminUsersListHandler(name string, service serviceAdminUsers) *AdminUsersListHandler {
	return &AdminUsersListHandler{name: name, service: service}
}

func NewAdminUserPatchHandler(name string, service serviceAdminUsers) *AdminUserPatchHandler {
	return &AdminUserPatchHandler{name: name, service: service}
}

func (h *AdminUsersListHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	actorID := r.Context().Value(defenitions.UserID).(model.UserID)

	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	offset := 0
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	items, total, err := h.service.ListUsersForSystemAdmin(r.Context(), actorID, limit, offset)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type response struct {
		Items []*model.AdminUserListItem `json:"items"`
		Total int64                      `json:"total"`
	}
	if err := uhttp.SendSuccess(w, response{Items: items, Total: total}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

type patchAdminUserBody struct {
	Role    *string `json:"role"`
	Blocked *bool   `json:"blocked"`
}

func (h *AdminUserPatchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	actorID := r.Context().Value(defenitions.UserID).(model.UserID)
	raw := strings.TrimSpace(r.PathValue("userId"))
	if raw == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("userId is required", nil))
		return
	}
	uid64, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || uid64 < 1 {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid userId", nil))
		return
	}
	targetID := model.UserID(uid64)

	var body patchAdminUserBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid JSON body", err))
		return
	}
	var rolePtr *string
	if body.Role != nil {
		t := strings.TrimSpace(*body.Role)
		if t != "" {
			rolePtr = &t
		}
	}
	if rolePtr == nil && body.Blocked == nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("role or blocked is required", nil))
		return
	}

	user, err := h.service.PatchUserBySystemAdmin(r.Context(), actorID, targetID, rolePtr, body.Blocked)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	if err := uhttp.SendSuccess(w, user); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
