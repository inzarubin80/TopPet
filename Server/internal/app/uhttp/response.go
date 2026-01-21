package uhttp

import (
	"encoding/json"
	"net/http"
)

type errorResponse struct {
	Error   bool   `json:"error"`
	Message string `json:"message"`
}

func SendSuccessfulResponse(w http.ResponseWriter, jsonContent []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(jsonContent)
}

func SendErrorResponse(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	jsonData, _ := json.Marshal(errorResponse{Error: true, Message: message})
	_, _ = w.Write(jsonData)
}
