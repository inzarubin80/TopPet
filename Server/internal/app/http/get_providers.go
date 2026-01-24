package http

import (
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

	if err := uhttp.SendSuccess(w, providerOauthConfFrontend); err != nil {
		uhttp.HandleError(w, uhttp.NewInternalServerError("failed to send response", err))
		return
	}
}
