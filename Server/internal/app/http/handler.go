package http

import (
	"encoding/json"
	"net/http"

	"toppet/server/internal/app/uhttp"
)

// BaseHandler предоставляет базовую функциональность для всех HTTP handlers
type BaseHandler struct {
	name string
}

// NewBaseHandler создает новый базовый handler
func NewBaseHandler(name string) *BaseHandler {
	return &BaseHandler{name: name}
}

// ParseJSON парсит JSON из тела запроса в указанную структуру
func (h *BaseHandler) ParseJSON(r *http.Request, v interface{}) error {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return uhttp.NewBadRequestError("invalid json", err)
	}
	return nil
}

// SendJSON отправляет произвольный объект как JSON ответ
func (h *BaseHandler) SendJSON(w http.ResponseWriter, statusCode int, data interface{}) error {
	return uhttp.SendJSON(w, statusCode, data)
}

// SendSuccess отправляет успешный ответ с данными
func (h *BaseHandler) SendSuccess(w http.ResponseWriter, data interface{}) error {
	return uhttp.SendSuccess(w, data)
}

// HandleError обрабатывает ошибку и отправляет соответствующий HTTP ответ
func (h *BaseHandler) HandleError(w http.ResponseWriter, err error) {
	uhttp.HandleError(w, err)
}

// GetPathValue извлекает значение параметра из пути
func (h *BaseHandler) GetPathValue(r *http.Request, param string) string {
	return r.PathValue(param)
}

// GetQueryValue извлекает значение параметра из query string
func (h *BaseHandler) GetQueryValue(r *http.Request, param string) string {
	return r.URL.Query().Get(param)
}
