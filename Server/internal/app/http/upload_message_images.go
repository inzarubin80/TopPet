package http

import (
	"context"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
	"toppet/server/internal/storage/objectstorage"
)

type serviceChatImageUpload interface {
	EnsureContestChatImageUploadAllowed(ctx context.Context, contestID model.ContestID, userID model.UserID) error
}

type serviceCommentImageUpload interface {
	EnsureParticipantCommentImageUploadAllowed(ctx context.Context, participantID model.ParticipantID, userID model.UserID) error
}

// UploadChatMessageImageHandler POST /api/contests/{contestId}/chat/upload-image
type UploadChatMessageImageHandler struct {
	name    string
	service serviceChatImageUpload
	upload  *objectstorage.Uploader
}

func NewUploadChatMessageImageHandler(name string, service serviceChatImageUpload, upload *objectstorage.Uploader) *UploadChatMessageImageHandler {
	return &UploadChatMessageImageHandler{name: name, service: service, upload: upload}
}

func (h *UploadChatMessageImageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}
	if err := h.service.EnsureContestChatImageUploadAllowed(r.Context(), contestID, userID); err != nil {
		uhttp.HandleError(w, err)
		return
	}

	uploadCtx, cancel := appcontext.WithUploadTimeout(r.Context())
	defer cancel()

	const maxForm = 8 << 20
	if err := r.ParseMultipartForm(maxForm); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("failed to parse multipart form", err))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("file is required", err))
		return
	}
	defer file.Close()

	ct := strings.TrimSpace(header.Header.Get("Content-Type"))
	if ct == "" {
		ct = mime.TypeByExtension(strings.ToLower(filepath.Ext(header.Filename)))
	}
	if !isAllowedChatImageContentType(ct) {
		uhttp.HandleError(w, uhttp.NewBadRequestError("file must be an image (not svg)", nil))
		return
	}

	size := header.Size
	if size <= 0 {
		size = -1
	}

	key := "contests/" + string(contestID) + "/chat/" + uuid.New().String()
	url, err := h.upload.Upload(uploadCtx, key, file, size, ct)
	if err != nil {
		log.Printf("upload chat image contest=%s: %v", contestID, err)
		if objectstorage.IsNoSuchBucketError(err) {
			uhttp.HandleError(w, uhttp.NewBadGatewayError(
				"Object storage bucket is missing or S3_BUCKET is wrong.",
				err,
			))
			return
		}
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to upload file", err))
		return
	}
	if err := uhttp.SendSuccess(w, map[string]string{"url": url}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

// UploadCommentImageHandler POST /api/participants/{participantId}/comments/upload-image
type UploadCommentImageHandler struct {
	name    string
	service serviceCommentImageUpload
	upload  *objectstorage.Uploader
}

func NewUploadCommentImageHandler(name string, service serviceCommentImageUpload, upload *objectstorage.Uploader) *UploadCommentImageHandler {
	return &UploadCommentImageHandler{name: name, service: service, upload: upload}
}

func (h *UploadCommentImageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))
	if participantID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("participantId is required", nil))
		return
	}
	if err := h.service.EnsureParticipantCommentImageUploadAllowed(r.Context(), participantID, userID); err != nil {
		uhttp.HandleError(w, err)
		return
	}

	uploadCtx, cancel := appcontext.WithUploadTimeout(r.Context())
	defer cancel()

	const maxForm = 8 << 20
	if err := r.ParseMultipartForm(maxForm); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("failed to parse multipart form", err))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("file is required", err))
		return
	}
	defer file.Close()

	ct := strings.TrimSpace(header.Header.Get("Content-Type"))
	if ct == "" {
		ct = mime.TypeByExtension(strings.ToLower(filepath.Ext(header.Filename)))
	}
	if !isAllowedChatImageContentType(ct) {
		uhttp.HandleError(w, uhttp.NewBadRequestError("file must be an image (not svg)", nil))
		return
	}

	size := header.Size
	if size <= 0 {
		size = -1
	}

	key := "contests/participants/" + string(participantID) + "/comment-images/" + uuid.New().String()
	url, err := h.upload.Upload(uploadCtx, key, file, size, ct)
	if err != nil {
		log.Printf("upload comment image participant=%s: %v", participantID, err)
		if objectstorage.IsNoSuchBucketError(err) {
			uhttp.HandleError(w, uhttp.NewBadGatewayError(
				"Object storage bucket is missing or S3_BUCKET is wrong.",
				err,
			))
			return
		}
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to upload file", err))
		return
	}
	if err := uhttp.SendSuccess(w, map[string]string{"url": url}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

func isAllowedChatImageContentType(ct string) bool {
	ct = strings.TrimSpace(strings.ToLower(ct))
	if !strings.HasPrefix(ct, "image/") {
		return false
	}
	if strings.Contains(ct, "svg") {
		return false
	}
	return true
}
