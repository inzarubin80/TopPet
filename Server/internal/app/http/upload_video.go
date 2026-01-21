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

	if err := r.ParseMultipartForm(100 << 20); err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	key := "contests/participants/" + string(participantID) + "/video/" + uuid.New().String()
	url, err := h.uploader.Upload(r.Context(), key, file, header.Size, header.Header.Get("Content-Type"))
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	video, err := h.service.AddParticipantVideo(r.Context(), participantID, userID, url)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonData, _ := json.Marshal(video)
	uhttp.SendSuccessfulResponse(w, jsonData)
}
