package http

import (
	"context"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
	"toppet/server/internal/storage/objectstorage"
)

type serviceSetUserAvatarURL interface {
	SetCurrentUserAvatarURL(ctx context.Context, userID model.UserID, avatarURL string) (*model.User, error)
}

// UploadUserAvatarHandler POST /api/auth/me/upload-avatar
type UploadUserAvatarHandler struct {
	name    string
	service serviceSetUserAvatarURL
	upload  *objectstorage.Uploader
}

func NewUploadUserAvatarHandler(name string, service serviceSetUserAvatarURL, upload *objectstorage.Uploader) *UploadUserAvatarHandler {
	return &UploadUserAvatarHandler{name: name, service: service, upload: upload}
}

func (h *UploadUserAvatarHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := r.Context().Value(defenitions.UserID).(model.UserID)

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
	if size > 0 && size > maxForm {
		uhttp.HandleError(w, uhttp.NewBadRequestError("file too large", nil))
		return
	}

	key := "users/" + strconv.FormatInt(int64(userID), 10) + "/avatars/" + uuid.New().String()
	url, err := h.upload.Upload(uploadCtx, key, file, size, ct)
	if err != nil {
		log.Printf("upload user avatar user=%d: %v", userID, err)
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

	updated, err := h.service.SetCurrentUserAvatarURL(uploadCtx, userID, url)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, updated); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
