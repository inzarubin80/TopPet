package http

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
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

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	key := "contests/participants/" + string(participantID) + "/photos/" + uuid.New().String()
	url, err := h.uploader.Upload(r.Context(), key, file, header.Size, header.Header.Get("Content-Type"))
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	photo, err := h.service.AddParticipantPhoto(r.Context(), participantID, userID, url, nil)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(photo)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
