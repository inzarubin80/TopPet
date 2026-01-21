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
		CreateComment(ctx context.Context, participantID model.ParticipantID, userID model.UserID, text string) (*model.Comment, error)
		ListComments(ctx context.Context, participantID model.ParticipantID, limit, offset int) ([]*model.Comment, int64, error)
		UpdateComment(ctx context.Context, commentID model.CommentID, userID model.UserID, text string) (*model.Comment, error)
		DeleteComment(ctx context.Context, commentID model.CommentID, userID model.UserID) error
	}

	CommentsHandler struct {
		name    string
		service serviceComments
	}
)

func NewCommentsHandler(name string, service serviceComments) *CommentsHandler {
	return &CommentsHandler{name: name, service: service}
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

		comments, total, err := h.service.ListComments(r.Context(), participantID, limit, offset)
		if err != nil {
			uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}

		type resp struct {
			Items []*model.Comment `json:"items"`
			Total int64           `json:"total"`
		}
		jsonData, _ := json.Marshal(resp{Items: comments, Total: total})
		uhttp.SendSuccessfulResponse(w, jsonData)
		return
	}

	// POST
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	comment, err := h.service.CreateComment(r.Context(), participantID, userID, req.Text)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(comment)
	uhttp.SendSuccessfulResponse(w, jsonData)
}

func (h *CommentsHandler) UpdateComment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	commentID := model.CommentID(r.PathValue("commentId"))

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "invalid json")
		return
	}

	comment, err := h.service.UpdateComment(r.Context(), commentID, userID, req.Text)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(comment)
	uhttp.SendSuccessfulResponse(w, jsonData)
}

func (h *CommentsHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	commentID := model.CommentID(r.PathValue("commentId"))

	if err := h.service.DeleteComment(r.Context(), commentID, userID); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	uhttp.SendSuccessfulResponse(w, []byte(`{"ok":true}`))
}
