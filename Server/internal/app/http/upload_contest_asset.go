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

type (
	serviceUploadContestAsset interface {
		UploadContestAsset(ctx context.Context, contestID model.ContestID, userID model.UserID, kind, assetURL string) (*model.Contest, error)
	}

	UploadContestAssetHandler struct {
		name     string
		service  serviceUploadContestAsset
		uploader *objectstorage.Uploader
	}
)

func NewUploadContestAssetHandler(name string, service serviceUploadContestAsset, uploader *objectstorage.Uploader) *UploadContestAssetHandler {
	return &UploadContestAssetHandler{name: name, service: service, uploader: uploader}
}

func isAllowedContestImageContentType(ct string) bool {
	ct = strings.TrimSpace(strings.ToLower(ct))
	if !strings.HasPrefix(ct, "image/") {
		return false
	}
	// SVG в object storage как картинка конкурса — риск XSS при встраивании
	if strings.Contains(ct, "svg") {
		return false
	}
	return true
}

func (h *UploadContestAssetHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	kind := strings.TrimSpace(r.PathValue("kind"))

	if contestID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId is required", nil))
		return
	}
	switch kind {
	case "cover", "logo", "sponsor_logo":
	default:
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid kind: use cover, logo, or sponsor_logo", nil))
		return
	}

	uploadCtx, cancel := appcontext.WithUploadTimeout(r.Context())
	defer cancel()

	const maxForm = 15 << 20
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
	if !isAllowedContestImageContentType(ct) {
		uhttp.HandleError(w, uhttp.NewBadRequestError("file must be an image (not svg)", nil))
		return
	}

	size := header.Size
	if size <= 0 {
		// Часть клиентов не присылает Content-Length части; MinIO нужен -1 для потоковой загрузки.
		size = -1
	}

	key := "contests/" + string(contestID) + "/" + kind + "/" + uuid.New().String()
	url, err := h.uploader.Upload(uploadCtx, key, file, size, ct)
	if err != nil {
		log.Printf("upload contest asset kind=%s contest=%s: %v", kind, contestID, err)
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to upload file", err))
		return
	}

	contest, err := h.service.UploadContestAsset(uploadCtx, contestID, userID, kind, url)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, contest); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
