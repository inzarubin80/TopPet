package http

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	appcontext "toppet/server/internal/app/context"
	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
	"toppet/server/internal/storage/objectstorage"
)

type (
	serviceAddPhoto interface {
		AddParticipantPhoto(ctx context.Context, participantID model.ParticipantID, userID model.UserID, url string, thumbURL *string) (*model.Photo, error)
	}

	UploadPhotoHandler struct {
		name     string
		service  serviceAddPhoto
		uploader *objectstorage.Uploader
	}
)

func NewUploadPhotoHandler(name string, service serviceAddPhoto, uploader *objectstorage.Uploader) *UploadPhotoHandler {
	return &UploadPhotoHandler{name: name, service: service, uploader: uploader}
}

func (h *UploadPhotoHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))

	// Используем увеличенный таймаут для загрузки файлов
	uploadCtx, cancel := appcontext.WithUploadTimeout(r.Context())
	defer cancel()

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("failed to parse multipart form", err))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("file is required", err))
		return
	}
	defer file.Close()

	key := "contests/participants/" + string(participantID) + "/photos/" + uuid.New().String()
	url, err := h.uploader.Upload(uploadCtx, key, file, header.Size, header.Header.Get("Content-Type"))
	if err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to upload file", err))
		return
	}

	photo, err := h.service.AddParticipantPhoto(uploadCtx, participantID, userID, url, nil)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, photo); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
