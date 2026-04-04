package http

import (
	"context"
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/model"
)

type nominationsService interface {
	CreateNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, title, description string, minPhotoCount int) (*model.Nomination, error)
	UpdateNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID string, title, description string, minPhotoCount int) (*model.Nomination, error)
	ListNominations(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error)
	DeleteNomination(ctx context.Context, contestID model.ContestID, userID model.UserID, nominationID string) error
}

type NominationsHandler struct {
	name    string
	service nominationsService
}

func NewNominationsHandler(name string, service nominationsService) *NominationsHandler {
	return &NominationsHandler{name: name, service: service}
}

func (h *NominationsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	contestID := model.ContestID(r.PathValue("contestId"))
	switch r.Method {
	case http.MethodGet:
		items, err := h.service.ListNominations(r.Context(), contestID)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
	case http.MethodPost:
		userID := r.Context().Value(defenitions.UserID).(model.UserID)
		var body struct {
			Title          string `json:"title"`
			Description    string `json:"description"`
			MinPhotoCount *int   `json:"min_photo_count"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
			return
		}
		minPhotos := 1
		if body.MinPhotoCount != nil {
			minPhotos = *body.MinPhotoCount
		}
		n, err := h.service.CreateNomination(r.Context(), contestID, userID, body.Title, body.Description, minPhotos)
		if err != nil {
			uhttp.HandleError(w, err)
			return
		}
		_ = uhttp.SendSuccess(w, n)
	default:
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
	}
}

type PatchNominationHandler struct {
	name    string
	service nominationsService
}

func NewPatchNominationHandler(name string, service nominationsService) *PatchNominationHandler {
	return &PatchNominationHandler{name: name, service: service}
}

func (h *PatchNominationHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	nominationID := r.PathValue("nominationId")
	var body struct {
		Title           string `json:"title"`
		Description     string `json:"description"`
		MinPhotoCount  *int   `json:"min_photo_count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	minPhotos := 1
	if body.MinPhotoCount != nil {
		minPhotos = *body.MinPhotoCount
	} else {
		items, lerr := h.service.ListNominations(r.Context(), contestID)
		if lerr == nil {
			for _, it := range items {
				if it.ID == nominationID {
					minPhotos = it.MinPhotoCount
					break
				}
			}
		}
	}
	n, err := h.service.UpdateNomination(r.Context(), contestID, userID, nominationID, body.Title, body.Description, minPhotos)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, n)
}

type DeleteNominationHandler struct {
	name    string
	service nominationsService
}

func NewDeleteNominationHandler(name string, service nominationsService) *DeleteNominationHandler {
	return &DeleteNominationHandler{name: name, service: service}
}

func (h *DeleteNominationHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	userID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	nid := r.PathValue("nominationId")
	if err := h.service.DeleteNomination(r.Context(), contestID, userID, nid); err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]bool{"ok": true})
}

type juryCriteriaService interface {
	ListContestJuryCriteria(ctx context.Context, contestID model.ContestID) ([]*model.JuryCriterion, error)
	ReplaceContestJuryCriteria(ctx context.Context, contestID model.ContestID, adminID model.UserID, items []*model.JuryCriterionInput) ([]*model.JuryCriterion, error)
}

type registrationFieldsService interface {
	ListContestRegistrationFields(ctx context.Context, contestID model.ContestID) ([]*model.RegistrationField, error)
	ReplaceContestRegistrationFields(ctx context.Context, contestID model.ContestID, adminID model.UserID, items []*model.RegistrationFieldInput) ([]*model.RegistrationField, error)
}

type JuryCriteriaListHandler struct {
	name    string
	service juryCriteriaService
}

func NewJuryCriteriaListHandler(name string, service juryCriteriaService) *JuryCriteriaListHandler {
	return &JuryCriteriaListHandler{name: name, service: service}
}

func (h *JuryCriteriaListHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	items, err := h.service.ListContestJuryCriteria(r.Context(), contestID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
}

type JuryCriteriaReplaceHandler struct {
	name    string
	service juryCriteriaService
}

func NewJuryCriteriaReplaceHandler(name string, service juryCriteriaService) *JuryCriteriaReplaceHandler {
	return &JuryCriteriaReplaceHandler{name: name, service: service}
}

func (h *JuryCriteriaReplaceHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	adminID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	var body struct {
		Items []*model.JuryCriterionInput `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	if body.Items == nil {
		body.Items = []*model.JuryCriterionInput{}
	}
	items, err := h.service.ReplaceContestJuryCriteria(r.Context(), contestID, adminID, body.Items)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
}

type RegistrationFieldsListHandler struct {
	name    string
	service registrationFieldsService
}

func NewRegistrationFieldsListHandler(name string, service registrationFieldsService) *RegistrationFieldsListHandler {
	return &RegistrationFieldsListHandler{name: name, service: service}
}

func (h *RegistrationFieldsListHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	items, err := h.service.ListContestRegistrationFields(r.Context(), contestID)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
}

type RegistrationFieldsReplaceHandler struct {
	name    string
	service registrationFieldsService
}

func NewRegistrationFieldsReplaceHandler(name string, service registrationFieldsService) *RegistrationFieldsReplaceHandler {
	return &RegistrationFieldsReplaceHandler{name: name, service: service}
}

func (h *RegistrationFieldsReplaceHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		uhttp.HandleError(w, uhttp.NewBadRequestError("method not allowed", nil))
		return
	}
	adminID := r.Context().Value(defenitions.UserID).(model.UserID)
	contestID := model.ContestID(r.PathValue("contestId"))
	var body struct {
		Items []*model.RegistrationFieldInput `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		uhttp.HandleError(w, uhttp.NewBadRequestError("invalid json", err))
		return
	}
	if body.Items == nil {
		body.Items = []*model.RegistrationFieldInput{}
	}
	items, err := h.service.ReplaceContestRegistrationFields(r.Context(), contestID, adminID, body.Items)
	if err != nil {
		uhttp.HandleError(w, err)
		return
	}
	_ = uhttp.SendSuccess(w, map[string]interface{}{"items": items})
}
