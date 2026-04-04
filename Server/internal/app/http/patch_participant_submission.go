package http

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type servicePatchParticipantSubmission interface {
	SetParticipantSubmissionStatus(ctx context.Context, participantID model.ParticipantID, actorID model.UserID, status string, submissionComment *string) (*model.Participant, error)
}

type PatchParticipantSubmissionHandler struct {
	name    string
	service servicePatchParticipantSubmission
}

func NewPatchParticipantSubmissionHandler(name string, service servicePatchParticipantSubmission) *PatchParticipantSubmissionHandler {
	return &PatchParticipantSubmissionHandler{name: name, service: service}
}

func (h *PatchParticipantSubmissionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	participantID := model.ParticipantID(r.PathValue("participantId"))
	if participantID == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("participantId is required", nil))
		return
	}

	var req struct {
		SubmissionStatus  string  `json:"submission_status"`
		SubmissionComment *string `json:"submission_comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	if req.SubmissionStatus == "" {
		uhttp.HandleError(w, uhttp.NewBadRequestError("submission_status is required", nil))
		return
	}

	log.Printf("[PatchParticipantSubmission] participant=%s actor=%d status=%s", participantID, userID, req.SubmissionStatus)
	participant, err := h.service.SetParticipantSubmissionStatus(r.Context(), participantID, userID, req.SubmissionStatus, req.SubmissionComment)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}

	if err := uhttp.SendSuccess(w, participant); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
