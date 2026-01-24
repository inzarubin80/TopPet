package uhttp

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// SendSuccessfulResponse отправляет успешный JSON ответ
func SendSuccessfulResponse(w http.ResponseWriter, jsonContent []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(jsonContent); err != nil {
		// Логируем ошибку записи, но не можем отправить другой ответ
		// так как заголовки уже отправлены
		fmt.Printf("Failed to write response: %v\n", err)
	}
}

// SendErrorResponse отправляет JSON ответ с ошибкой
func SendErrorResponse(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	jsonData, err := json.Marshal(ErrorResponse{Error: true, Message: message})
	if err != nil {
		// Если не удалось замаршалить ошибку, отправляем простой текст
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error": true, "message": "failed to encode error response"}`))
		return
	}
	if _, err := w.Write(jsonData); err != nil {
		fmt.Printf("Failed to write error response: %v\n", err)
	}
}

// SendJSON отправляет произвольный объект как JSON ответ
func SendJSON(w http.ResponseWriter, statusCode int, data interface{}) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}
	if _, err := w.Write(jsonData); err != nil {
		return fmt.Errorf("failed to write response: %w", err)
	}
	return nil
}

// SendSuccess отправляет успешный ответ с данными
func SendSuccess(w http.ResponseWriter, data interface{}) error {
	return SendJSON(w, http.StatusOK, SuccessResponse{Data: data})
}
