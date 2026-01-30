package uhttp

import (
	"errors"
	"fmt"
	"net/http"

	"toppet/server/internal/model"
)

// AppError представляет ошибку приложения с HTTP статусом.
// Используется для типизированной обработки ошибок с автоматическим маппингом на HTTP статусы.
type AppError struct {
	Code    int    `json:"code"`    // HTTP статус код
	Message string `json:"message"` // Сообщение об ошибке
	Err     error  `json:"-"`       // Внутренняя ошибка (не сериализуется в JSON)
}

// Error реализует интерфейс error
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

// Unwrap возвращает внутреннюю ошибку для использования с errors.Is и errors.As
func (e *AppError) Unwrap() error {
	return e.Err
}

// NewAppError создает новую ошибку приложения с указанным HTTP статусом
func NewAppError(code int, message string, err error) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// NewBadRequestError создает ошибку 400 Bad Request
func NewBadRequestError(message string, err error) *AppError {
	return NewAppError(http.StatusBadRequest, message, err)
}

// NewUnauthorizedError создает ошибку 401 Unauthorized
func NewUnauthorizedError(message string, err error) *AppError {
	return NewAppError(http.StatusUnauthorized, message, err)
}

// NewForbiddenError создает ошибку 403 Forbidden
func NewForbiddenError(message string, err error) *AppError {
	return NewAppError(http.StatusForbidden, message, err)
}

// NewNotFoundError создает ошибку 404 Not Found
func NewNotFoundError(message string, err error) *AppError {
	return NewAppError(http.StatusNotFound, message, err)
}

// NewInternalServerError создает ошибку 500 Internal Server Error
func NewInternalServerError(message string, err error) *AppError {
	return NewAppError(http.StatusInternalServerError, message, err)
}

// HandleError обрабатывает ошибку и отправляет соответствующий HTTP ответ.
// Автоматически определяет HTTP статус на основе типа ошибки.
func HandleError(w http.ResponseWriter, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		SendErrorResponse(w, appErr.Code, appErr.Message)
		return
	}

	// Маппинг стандартных ошибок модели на HTTP статусы
	if errors.Is(err, model.ErrorNotFound) {
		SendErrorResponse(w, http.StatusNotFound, "not found")
		return
	}
	if errors.Is(err, model.ErrorForbidden) {
		SendErrorResponse(w, http.StatusForbidden, "forbidden")
		return
	}

	if errors.Is(err, model.ErrUnauthorized) {
		SendErrorResponse(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if errors.Is(err, model.ErrForbidden) {
		SendErrorResponse(w, http.StatusForbidden, "forbidden")
		return
	}

	if errors.Is(err, model.ErrBadRequest) {
		SendErrorResponse(w, http.StatusBadRequest, "bad request")
		return
	}

	// Неизвестная ошибка - возвращаем 500
	SendErrorResponse(w, http.StatusInternalServerError, "internal server error")
}

// ErrorResponse представляет структуру ответа с ошибкой
type ErrorResponse struct {
	Error   bool   `json:"error"`
	Message string `json:"message"`
}

// SuccessResponse представляет структуру успешного ответа
type SuccessResponse struct {
	Data interface{} `json:"data,omitempty"`
}
