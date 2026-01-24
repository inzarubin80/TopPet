package http

import (
	"net/http"

	"toppet/server/internal/app/uhttp"
)

type PingHandler struct {
	name string
}

func NewPingHandler(name string) *PingHandler {
	return &PingHandler{name: name}
}

func (h *PingHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	type response struct {
		Status string `json:"status"`
	}
	if err := uhttp.SendSuccess(w, response{Status: "ok"}); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
