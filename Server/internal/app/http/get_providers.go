package http

import (
	"encoding/json"
	"net/http"

	authinterface "toppet/server/internal/app/authinterface"
	"toppet/server/internal/app/uhttp"
)

type GetProvidersHandler struct {
	name          string
	provadersConf authinterface.MapProviderOauthConf
}

func NewGetProvidersHandler(provadersConf authinterface.MapProviderOauthConf, name string) *GetProvidersHandler {
	return &GetProvidersHandler{
		name:          name,
		provadersConf: provadersConf,
	}
}

func (h *GetProvidersHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	providerOauthConfFrontend := []authinterface.ProviderOauthConfFrontend{}
	for key, value := range h.provadersConf {
		providerOauthConfFrontend = append(providerOauthConfFrontend,
			authinterface.ProviderOauthConfFrontend{
				Provider: key,
				IconSVG:  value.IconSVG,
				Name:     value.DisplayName,
			},
		)
	}

	jsonContent, err := json.Marshal(providerOauthConfFrontend)
	if err != nil {
		uhttp.SendErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}

	uhttp.SendSuccessfulResponse(w, jsonContent)
}
