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

type (
	serviceComments interface {
		CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string, parentID *model.CommentID, imageURL string) (*model.Comment, error)
		ListComments(ctx context.Context, participantID model.ParticipantID, limit, offset int, viewer *model.UserID) ([]*model.Comment, int64, error)
		UpdateComment(ctx context.Context, commentID model.CommentID, userID model.UserID, text string) (*model.Comment, error)
		DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) error
		VoteComment(ctx context.Context, commentID model.CommentID, userID model.UserID, value int16) error
	}

	CommentsHandler struct {
		name        string
		service     serviceComments
		authService serviceOptionalAuth
	}
)

func NewCommentsHandler(name string, service serviceComments) *CommentsHandler {
	var authService serviceOptionalAuth
	if svc, ok := service.(serviceOptionalAuth); ok {
		authService = svc
	}
	return &CommentsHandler{name: name, service: service, authService: authService}
}

func (h *CommentsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	participantID := model.ParticipantID(r.PathValue("participantId"))

	if r.Method == http.MethodGet {
		limit := 20
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil {
				limit = n
			}
		}
		offset := 0
		if o := r.URL.Query().Get("offset"); o != "" {
			if n, err := strconv.Atoi(o); err == nil {
				offset = n
			}
		}

		var viewer *model.UserID
		if userIDVal := r.Context().Value(defenitions.UserID); userIDVal != nil {
			uid := userIDVal.(model.UserID)
			viewer = &uid
		} else if h.authService != nil {
			uid, ok, authErr := getOptionalUserID(r, h.authService)
			if authErr != nil {
				uhttp.HandleError(w, uhttp.NewUnauthorizedError("authentication error", authErr))
				return
			}
			if ok {
				viewer = &uid
			}
		}

		comments, total, err := h.service.ListComments(r.Context(), participantID, limit, offset, viewer)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}

		type resp struct {
			Items []*model.Comment `json:"items"`
			Total int64            `json:"total"`
		}
		if err := uhttp.SendSuccess(w, resp{Items: comments, Total: total}); err != nil {
			uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		}
		return
	}

	// POST
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	var req struct {
		Text     string           `json:"text"`
		ParentID *model.CommentID `json:"parent_id"`
		ImageURL string           `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	comment, err := h.service.CreateComment(r.Context(), participantID, userID, req.Text, req.ParentID, req.ImageURL)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, comment); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}

func (h *CommentsHandler) VoteComment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	commentID := model.CommentID(r.PathValue("commentId"))
	var req struct {
		Value int16 `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	if err := h.service.VoteComment(r.Context(), commentID, userID, req.Value); err != nil {
		uhttp.HandleError(w, err)
		return
	}
	if err := uhttp.SendSuccess(w, map[string]bool{"ok": true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

func (h *CommentsHandler) UpdateComment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	commentID := model.CommentID(r.PathValue("commentId"))

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}

	comment, err := h.service.UpdateComment(r.Context(), commentID, userID, req.Text)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, comment); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}

func (h *CommentsHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	commentID := model.CommentID(r.PathValue("commentId"))

	if err := h.service.DeleteComment(r.Context(), commentID, userID); err != nil {
		uhttp.HandleError(w, err)
		return
	}

	type response struct {
		OK bool `json:"ok"`
	}
	if err := uhttp.SendSuccess(w, response{OK: true}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
