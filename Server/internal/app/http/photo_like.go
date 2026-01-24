package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type (
	servicePhotoLike interface {
		LikePhoto(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error)
		UnlikePhoto(ctx context.Context, photoID string, userID model.UserID) error
		GetPhotoLike(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error)
		GetPhotoLikesCount(ctx context.Context, photoID string) (int64, error)
	}

	PhotoLikeHandler struct {
		name    string
		service servicePhotoLike
	}
)

func NewPhotoLikeHandler(name string, service servicePhotoLike) *PhotoLikeHandler {
	return &PhotoLikeHandler{name: name, service: service}
}

func (h *PhotoLikeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	photoID := r.PathValue("photoId")

	if r.Method == http.MethodGet {
		// Get user like status (optional auth)
		userIDVal := r.Context().Value(defenitions.UserID)
		if userIDVal == nil {
			// Return like count only if not authenticated
			count, err := h.service.GetPhotoLikesCount(r.Context(), photoID)
			if err != nil {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			type resp struct {
				LikeCount int64 `json:"like_count"`
				IsLiked   bool  `json:"is_liked"`
			}
			jsonData, _ := json.Marshal(resp{LikeCount: count, IsLiked: false})
			uhttp.SendSuccessfulResponse(w, jsonData)
			return
		}
		userID := userIDVal.(model.UserID)
		_, err := h.service.GetPhotoLike(r.Context(), photoID, userID)
		count, _ := h.service.GetPhotoLikesCount(r.Context(), photoID)
		if err != nil {
			// User hasn't liked, but return count
			type resp struct {
				LikeCount int64 `json:"like_count"`
				IsLiked   bool  `json:"is_liked"`
			}
			jsonData, _ := json.Marshal(resp{LikeCount: count, IsLiked: false})
			uhttp.SendSuccessfulResponse(w, jsonData)
			return
		}
		type resp struct {
			LikeCount int64 `json:"like_count"`
			IsLiked   bool  `json:"is_liked"`
		}
		jsonData, _ := json.Marshal(resp{LikeCount: count, IsLiked: true})
		uhttp.SendSuccessfulResponse(w, jsonData)
		return
	}

	if r.Method == http.MethodDelete {
		userID := r.Context().Value(defenitions.UserID).(model.UserID)
		err := h.service.UnlikePhoto(r.Context(), photoID, userID)
		if err != nil {
			if errors.Is(err, model.ErrorNotFound) {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		count, _ := h.service.GetPhotoLikesCount(r.Context(), photoID)
		type resp struct {
			LikeCount int64 `json:"like_count"`
			IsLiked   bool  `json:"is_liked"`
		}
		jsonData, _ := json.Marshal(resp{LikeCount: count, IsLiked: false})
		uhttp.SendSuccessfulResponse(w, jsonData)
		return
	}

	// POST like
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

	_, err := h.service.LikePhoto(r.Context(), photoID, userID)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	count, _ := h.service.GetPhotoLikesCount(r.Context(), photoID)
	type resp struct {
		LikeCount int64 `json:"like_count"`
		IsLiked   bool  `json:"is_liked"`
	}
	jsonData, _ := json.Marshal(resp{LikeCount: count, IsLiked: true})
	uhttp.SendSuccessfulResponse(w, jsonData)
}
