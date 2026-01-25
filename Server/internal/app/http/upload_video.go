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
	serviceAddVideo interface {
		AddParticipantVideo(ctx context.Context, participantID model.ParticipantID, userID model.UserID, url string) (*model.Video, error)
	}

	UploadVideoHandler struct {
		name     string
		service  serviceAddVideo
		uploader *objectstorage.Uploader
	}
)

func NewUploadVideoHandler(name string, service serviceAddVideo, uploader *objectstorage.Uploader) *UploadVideoHandler {
	return &UploadVideoHandler{name: name, service: service, uploader: uploader}
}

func (h *UploadVideoHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))

	// Используем увеличенный таймаут для загрузки видео
	uploadCtx, cancel := appcontext.WithUploadTimeout(r.Context())
	defer cancel()

	if err := r.ParseMultipartForm(100 << 20); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("failed to parse multipart form", err))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("file is required", err))
		return
	}
	defer file.Close()

	key := "contests/participants/" + string(participantID) + "/video/" + uuid.New().String()
	url, err := h.uploader.Upload(uploadCtx, key, file, header.Size, header.Header.Get("Content-Type"))
	if err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to upload file", err))
		return
	}

	video, err := h.service.AddParticipantVideo(uploadCtx, participantID, userID, url)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, video); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
