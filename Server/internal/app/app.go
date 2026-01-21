package app

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/sessions"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"

	appHttp "toppet/server/internal/app/http"
	"toppet/server/internal/app/http/middleware"
	"toppet/server/internal/app/ws"
	"toppet/server/internal/repository"
	"toppet/server/internal/service"
	"toppet/server/internal/storage/objectstorage"
	tokenservice "toppet/server/internal/app/token_service"
)

const (
	readHeaderTimeoutSeconds = 30
	readTimeoutSeconds       = 60
	writeTimeoutSeconds      = 60
	idleTimeoutSeconds       = 300
)

type (
	mux interface {
		Handle(pattern string, handler http.Handler)
	}
	server interface {
		ListenAndServe() error
		Close() error
	}

	App struct {
		mux               mux
		server            server
		service           *service.TopPetService
		config            Config
		hub               *ws.Hub
		uploader          *objectstorage.Uploader
		store             *sessions.CookieStore
		loginStateStore   map[string]appHttp.StateData
		loginStateStoreMu sync.Mutex
	}
)

func NewApp(ctx context.Context, config Config, dbConn *pgxpool.Pool) (*App, error) {
	mux := http.NewServeMux()
	hub := ws.NewHub()

	// Build cookie store
	store := sessions.NewCookieStore([]byte(config.StoreSecret))
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 30,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
	}

	// Build repository
	repo := repository.NewRepository(dbConn)

	// Build token services
	accessTokenService := tokenservice.NewTokenService(
		[]byte(config.AccessTokenSecret),
		time.Duration(config.AccessTokenTTLSec)*time.Second,
		"access",
	)
	refreshTokenService := tokenservice.NewTokenService(
		[]byte(config.RefreshTokenSecret),
		time.Duration(config.RefreshTokenTTLSec)*time.Second,
		"refresh",
	)

	// Build providers user data map
	providersMap := make(map[string]service.ProviderUserData)
	for key, prov := range config.ProvidersConf {
		if prov != nil && prov.ProviderUserData != nil {
			providersMap[key] = prov.ProviderUserData
		}
	}

	// Build service
	topPetService := service.NewTopPetService(repo, hub, accessTokenService, refreshTokenService, providersMap)

	// Build object storage uploader
	var uploader *objectstorage.Uploader
	if config.S3Endpoint != "" {
		var err error
		uploader, err = objectstorage.NewUploader(
			config.S3Endpoint,
			config.S3AccessKey,
			config.S3SecretKey,
			config.S3Bucket,
			config.S3CDNBase,
			config.S3Secure,
		)
		if err != nil {
			return nil, err
		}
	}

	// CORS middleware
	corsOptions := cors.Options{
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders: []string{
			"Origin", "Content-Type", "Accept", "Authorization",
			"X-Requested-With", "Cookie",
		},
		AllowCredentials: true,
		ExposedHeaders:   []string{"Set-Cookie"},
		MaxAge:           86400,
	}

	allowedOriginsMap := make(map[string]bool)
	for _, origin := range config.CorsAllowedOrigins {
		allowedOriginsMap[origin] = true
	}

	devOrigins := []string{"http://localhost:3000", "http://10.0.2.2"}
	devOriginsMap := make(map[string]bool)
	for _, origin := range devOrigins {
		devOriginsMap[origin] = true
	}

	corsOptions.AllowOriginVaryRequestFunc = func(r *http.Request, origin string) (bool, []string) {
		if origin == "" {
			return false, nil
		}
		if len(config.CorsAllowedOrigins) > 0 {
			if allowedOriginsMap[origin] {
				return true, nil
			}
			return false, nil
		}
		if devOriginsMap[origin] {
			return true, nil
		}
		return false, nil
	}

	corsMiddleware := cors.New(corsOptions)

	app := &App{
		mux:               mux,
		service:           topPetService,
		config:            config,
		hub:               hub,
		uploader:          uploader,
		store:             store,
		loginStateStore:   make(map[string]appHttp.StateData),
		loginStateStoreMu: sync.Mutex{},
	}

	app.registerRoutes()

	handler := corsMiddleware.Handler(mux)

	app.server = &http.Server{
		Addr:              config.Addr,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeoutSeconds * time.Second,
		ReadTimeout:       readTimeoutSeconds * time.Second,
		WriteTimeout:      writeTimeoutSeconds * time.Second,
		IdleTimeout:       idleTimeoutSeconds * time.Second,
	}

	return app, nil
}

func (a *App) registerRoutes() {
	// Ping
	a.mux.Handle("GET /api/ping", appHttp.NewPingHandler("/api/ping"))

	// Auth
	a.mux.Handle("POST /api/auth/dev-login", appHttp.NewDevLoginHandler(a.service, "/api/auth/dev-login"))
	a.mux.Handle("POST /api/auth/refresh", appHttp.NewRefreshTokenHandler(a.service, "/api/auth/refresh"))
	a.mux.Handle("GET /api/auth/providers", appHttp.NewGetProvidersHandler(a.config.ProvidersConf, "/api/auth/providers"))
	a.mux.Handle("POST /api/auth/login", appHttp.NewLoginHandler(a.config.ProvidersConf, "/api/auth/login", a.store, a.loginStateStore, &a.loginStateStoreMu))
	a.mux.Handle("GET /api/auth/callback", appHttp.NewOAuthCallbackHandler(a.config.ProvidersConf, "/api/auth/callback", a.store, a.loginStateStore, &a.loginStateStoreMu, a.service))

	// Contests (public)
	a.mux.Handle("GET /api/contests", appHttp.NewListContestsHandler("/api/contests", a.service))
	a.mux.Handle("GET /api/contests/{contestId}", appHttp.NewGetContestHandler("/api/contests/{contestId}", a.service))

	// Contests (auth required)
	a.mux.Handle("POST /api/contests", middleware.NewAuthMiddleware(
		appHttp.NewCreateContestHandler("/api/contests", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/contests/{contestId}", middleware.NewAuthMiddleware(
		appHttp.NewUpdateContestHandler("/api/contests/{contestId}", a.service),
		a.service,
	))
	a.mux.Handle("POST /api/contests/{contestId}/publish", middleware.NewAuthMiddleware(
		appHttp.NewPublishContestHandler("/api/contests/{contestId}/publish", a.service),
		a.service,
	))
	a.mux.Handle("POST /api/contests/{contestId}/finish", middleware.NewAuthMiddleware(
		appHttp.NewFinishContestHandler("/api/contests/{contestId}/finish", a.service),
		a.service,
	))

	// Participants (public)
	a.mux.Handle("GET /api/contests/{contestId}/participants/{participantId}", appHttp.NewGetParticipantHandler("/api/contests/{contestId}/participants/{participantId}", a.service))

	// Participants (auth required)
	a.mux.Handle("POST /api/contests/{contestId}/participants", middleware.NewAuthMiddleware(
		appHttp.NewCreateParticipantHandler("/api/contests/{contestId}/participants", a.service),
		a.service,
	))
	if a.uploader != nil {
		a.mux.Handle("POST /api/participants/{participantId}/photos", middleware.NewAuthMiddleware(
			appHttp.NewUploadPhotoHandler("/api/participants/{participantId}/photos", a.service, a.uploader),
			a.service,
		))
		a.mux.Handle("POST /api/participants/{participantId}/video", middleware.NewAuthMiddleware(
			appHttp.NewUploadVideoHandler("/api/participants/{participantId}/video", a.service, a.uploader),
			a.service,
		))
	}

	// Votes
	a.mux.Handle("GET /api/contests/{contestId}/vote", appHttp.NewVoteHandler("/api/contests/{contestId}/vote", a.service))
	a.mux.Handle("POST /api/contests/{contestId}/vote", middleware.NewAuthMiddleware(
		appHttp.NewVoteHandler("/api/contests/{contestId}/vote", a.service),
		a.service,
	))

	// Comments (public)
	commentsHandler := appHttp.NewCommentsHandler("/api/participants/{participantId}/comments", a.service)
	a.mux.Handle("GET /api/participants/{participantId}/comments", commentsHandler)
	a.mux.Handle("POST /api/participants/{participantId}/comments", middleware.NewAuthMiddleware(commentsHandler, a.service))
	a.mux.Handle("PATCH /api/comments/{commentId}", middleware.NewAuthMiddleware(
		http.HandlerFunc(commentsHandler.UpdateComment),
		a.service,
	))
	a.mux.Handle("DELETE /api/comments/{commentId}", middleware.NewAuthMiddleware(
		http.HandlerFunc(commentsHandler.DeleteComment),
		a.service,
	))

	// Chat (public)
	a.mux.Handle("GET /api/contests/{contestId}/chat", appHttp.NewChatHandler("/api/contests/{contestId}/chat", a.service))
	a.mux.Handle("GET /api/contests/{contestId}/chat/ws", appHttp.NewContestChatWSHandler("/api/contests/{contestId}/chat/ws", a.service, a.hub))
}

func (a *App) ListenAndServe() error {
	go a.hub.Run()
	fmt.Println("start server on", a.config.Addr)
	return a.server.ListenAndServe()
}
