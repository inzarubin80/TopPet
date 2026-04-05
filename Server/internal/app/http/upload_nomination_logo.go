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

type serviceUpdateNominationLogo interface {
	UpdateNominationLogoURL(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID string, logoURL string) (*model.Nomination, error)
}

type UploadNominationLogoHandler struct {
	name     string
	service  serviceUpdateNominationLogo
	uploader *objectstorage.Uploader
}

func NewUploadNominationLogoHandler(name string, service serviceUpdateNominationLogo, uploader *objectstorage.Uploader) *UploadNominationLogoHandler {
	return &UploadNominationLogoHandler{name: name, service: service, uploader: uploader}
}

func (h *UploadNominationLogoHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	nominationID := strings.TrimSpace(r.PathValue("nominationId"))

	if contestID == "" || nominationID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("contestId and nominationId are required", nil))
		return
	}

	ctx, cancel := appcontext.WithUploadTimeout(r.Context())
	defer cancel()

	switch r.Method {
	case http.MethodPost:
		h.postLogo(ctx, w, r, userID, contestID, nominationID)
	case http.MethodDelete:
		h.clearLogo(ctx, w, userID, contestID, nominationID)
	default:
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
	}
}

func (h *UploadNominationLogoHandler) clearLogo(ctx context.Context, w http.ResponseWriter, userID model.UserID, contestID model.ContestID, nominationID string) {
	nom, err := h.service.UpdateNominationLogoURL(ctx, contestID, userID, nominationID, "")
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	if err := uhttp.SendSuccess(w, nom); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

func (h *UploadNominationLogoHandler) postLogo(ctx context.Context, w http.ResponseWriter, r *http.Request, userID model.UserID, contestID model.ContestID, nominationID string) {
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
		size = -1
	}

	key := "contests/" + string(contestID) + "/nominations/" + nominationID + "/logo/" + uuid.New().String()
	url, err := h.uploader.Upload(ctx, key, file, size, ct)
	if err != nil {
		log.Printf("upload nomination logo contest=%s nomination=%s: %v", contestID, nominationID, err)
		if objectstorage.IsNoSuchBucketError(err) {
			uhttp.HandleError(w, uhttp.NewBadGatewayError(
				"Object storage bucket is missing or S3_BUCKET is wrong. Create the bucket in your provider (e.g. Yandex Cloud console) or set S3_BUCKET in .env to an existing bucket.",
				err,
			))
			return
		}
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to upload file", err))
		return
	}

	nom, err := h.service.UpdateNominationLogoURL(ctx, contestID, userID, nominationID, url)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, nom); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
