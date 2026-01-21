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
	uhttp.SendSuccessfulResponse(w, []byte(`{"status":"ok"}`))
}
