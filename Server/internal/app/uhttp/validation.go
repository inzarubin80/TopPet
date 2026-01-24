package uhttp

import (
	"net/http"
)

// GetPathValue извлекает значение параметра из пути
func GetPathValue(r *http.Request, param string) string {
	return r.PathValue(param)
}

// GetQueryValue извлекает значение параметра из query string
func GetQueryValue(r *http.Request, param string) string {
	return r.URL.Query().Get(param)
}
