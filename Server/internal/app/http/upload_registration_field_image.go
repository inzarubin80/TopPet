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

type serviceRegistrationImageUpload interface {
	EnsureRegistrationImageUploadAllowed(ctx context.Context, contestID model.ContestID, fieldID string) error
}

type UploadRegistrationFieldImageHandler struct {
	name    string
	service serviceRegistrationImageUpload
	upload  *objectstorage.Uploader
}

func NewUploadRegistrationFieldImageHandler(name string, service serviceRegistrationImageUpload, upload *objectstorage.Uploader) *UploadRegistrationFieldImageHandler {
	return &UploadRegistrationFieldImageHandler{name: name, service: service, upload: upload}
}

func isAllowedRegistrationImageContentType(ct string) bool {
	ct = strings.TrimSpace(strings.ToLower(ct))
	if !strings.HasPrefix(ct, "image/") {
		return false
	}
	if strings.Contains(ct, "svg") {
		return false
	}
	return true
}

func (h *UploadRegistrationFieldImageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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

	uploadCtx, cancel := appcontext.WithUploadTimeout(r.Context())
	defer cancel()

	const maxForm = 10 << 20
	if err := r.ParseMultipartForm(maxForm); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("failed to parse multipart form", err))
		return
	}

	fieldID := strings.TrimSpace(r.FormValue("field_id"))

	if err := h.service.EnsureRegistrationImageUploadAllowed(uploadCtx, contestID, fieldID); err != nil {
		uhttp.HandleError(w, err)
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
	if !isAllowedRegistrationImageContentType(ct) {
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

	key := "contests/" + string(contestID) + "/registration-images/" + strconv.FormatInt(int64(userID), 10) + "/" + uuid.New().String()

	uploadedURL, err := h.upload.Upload(uploadCtx, key, file, size, ct)
	if err != nil {
		log.Printf("upload registration field image contest=%s: %v", contestID, err)
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

	if err := uhttp.SendSuccess(w, map[string]string{"url": uploadedURL}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
