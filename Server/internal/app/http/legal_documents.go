package http

import (
	"errors"
	"io/fs"
	"net/http"

	"toppet/server/internal/app/uhttp"
	"toppet/server/internal/legal"
)

type LegalDocumentsProvider interface {
	List() []legal.DocumentSummary
	Get(id string) (legal.Document, error)
}

type ListLegalDocumentsHandler struct {
	name     string
	provider LegalDocumentsProvider
}

func NewListLegalDocumentsHandler(name string, provider LegalDocumentsProvider) *ListLegalDocumentsHandler {
	return &ListLegalDocumentsHandler{name: name, provider: provider}
}

func (h *ListLegalDocumentsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	items := h.provider.List()
	if err := uhttp.SendSuccess(w, items); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}

type GetLegalDocumentHandler struct {
	name     string
	provider LegalDocumentsProvider
}

func NewGetLegalDocumentHandler(name string, provider LegalDocumentsProvider) *GetLegalDocumentHandler {
	return &GetLegalDocumentHandler{name: name, provider: provider}
}

func (h *GetLegalDocumentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("documentId")
	doc, err := h.provider.Get(id)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			uhttp.HandleError(w, uhttp.NewNotFoundError("document not found", nil))
			return
		}
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to load document", err))
		return
	}
	if err := uhttp.SendSuccess(w, doc); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
	}
}
