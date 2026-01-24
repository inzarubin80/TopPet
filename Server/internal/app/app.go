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
	tokenservice "toppet/server/internal/app/token_service"
	"toppet/server/internal/app/ws"
	"toppet/server/internal/repository"
	"toppet/server/internal/service"
	"toppet/server/internal/storage/objectstorage"
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
	// Build allowed origins list
	// Always include default dev origins
	allowedOrigins := []string{"http://localhost:3000", "http://localhost:5173", "http://10.0.2.2"}

	// Add configured origins from environment
	if len(config.CorsAllowedOrigins) > 0 {
		seen := make(map[string]bool)
		// Mark default origins as seen
		for _, origin := range allowedOrigins {
			seen[origin] = true
		}
		// Add configured origins (avoid duplicates)
		for _, origin := range config.CorsAllowedOrigins {
			if origin != "" && !seen[origin] {
				seen[origin] = true
				allowedOrigins = append(allowedOrigins, origin)
			}
		}
	}

	corsOptions := cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders: []string{
			"Origin", "Content-Type", "Accept", "Authorization",
			"X-Requested-With", "Cookie",
		},
		AllowCredentials: true,
		ExposedHeaders:   []string{"Set-Cookie"},
		MaxAge:           86400,
		Debug:            false,
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
	a.mux.Handle("POST /api/auth/refresh", appHttp.NewRefreshTokenHandler(a.service, "/api/auth/refresh"))
	a.mux.Handle("GET /api/auth/providers", appHttp.NewGetProvidersHandler(a.config.ProvidersConf, "/api/auth/providers"))
	a.mux.Handle("POST /api/auth/login", appHttp.NewLoginHandler(a.config.ProvidersConf, "/api/auth/login", a.store, a.loginStateStore, &a.loginStateStoreMu))
	a.mux.Handle("GET /api/auth/callback", appHttp.NewOAuthCallbackHandler(a.config.ProvidersConf, "/api/auth/callback", a.store, a.loginStateStore, &a.loginStateStoreMu, a.service))
	a.mux.Handle("GET /api/auth/me", middleware.NewAuthMiddleware(
		appHttp.NewGetCurrentUserHandler("/api/auth/me", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/auth/me", middleware.NewAuthMiddleware(
		appHttp.NewUpdateCurrentUserHandler("/api/auth/me", a.service),
		a.service,
	))

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
	a.mux.Handle("PATCH /api/contests/{contestId}/status", middleware.NewAuthMiddleware(
		appHttp.NewUpdateContestStatusHandler("/api/contests/{contestId}/status", a.service),
		a.service,
	))
	a.mux.Handle("DELETE /api/contests/{contestId}", middleware.NewAuthMiddleware(
		appHttp.NewDeleteContestHandler("/api/contests/{contestId}", a.service),
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
	a.mux.Handle("GET /api/contests/{contestId}/participants", appHttp.NewListParticipantsHandler("/api/contests/{contestId}/participants", a.service))
	a.mux.Handle("GET /api/contests/{contestId}/participants/{participantId}", appHttp.NewGetParticipantHandler("/api/contests/{contestId}/participants/{participantId}", a.service))

	// Participants (auth required)
	a.mux.Handle("POST /api/contests/{contestId}/participants", middleware.NewAuthMiddleware(
		appHttp.NewCreateParticipantHandler("/api/contests/{contestId}/participants", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/participants/{participantId}", middleware.NewAuthMiddleware(
		appHttp.NewUpdateParticipantHandler("/api/participants/{participantId}", a.service),
		a.service,
	))
	a.mux.Handle("DELETE /api/participants/{participantId}", middleware.NewAuthMiddleware(
		appHttp.NewDeleteParticipantHandler("/api/participants/{participantId}", a.service),
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
	a.mux.Handle("DELETE /api/participants/{participantId}/photos/{photoId}", middleware.NewAuthMiddleware(
		appHttp.NewDeletePhotoHandler("/api/participants/{participantId}/photos/{photoId}", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/participants/{participantId}/photos/order", middleware.NewAuthMiddleware(
		appHttp.NewUpdatePhotoOrderHandler("/api/participants/{participantId}/photos/order", a.service),
		a.service,
	))

	// Photo Likes
	photoLikeHandler := appHttp.NewPhotoLikeHandler("/api/photos/{photoId}/like", a.service)
	a.mux.Handle("GET /api/photos/{photoId}/like", photoLikeHandler)
	a.mux.Handle("POST /api/photos/{photoId}/like", middleware.NewAuthMiddleware(photoLikeHandler, a.service))
	a.mux.Handle("DELETE /api/photos/{photoId}/like", middleware.NewAuthMiddleware(photoLikeHandler, a.service))

	// Votes
	a.mux.Handle("GET /api/contests/{contestId}/vote", appHttp.NewVoteHandler("/api/contests/{contestId}/vote", a.service))
	a.mux.Handle("POST /api/contests/{contestId}/vote", middleware.NewAuthMiddleware(
		appHttp.NewVoteHandler("/api/contests/{contestId}/vote", a.service),
		a.service,
	))
	a.mux.Handle("DELETE /api/contests/{contestId}/vote", middleware.NewAuthMiddleware(
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
	a.mux.Handle("GET /api/contests/{contestId}/chat/ws", appHttp.NewContestChatWSHandler("/api/contests/{contestId}/chat/ws", a.service, a.service, a.hub))
	chatMessageHandler := appHttp.NewChatMessageHandler("/api/chat/{messageId}", a.service)
	a.mux.Handle("PATCH /api/chat/{messageId}", middleware.NewAuthMiddleware(
		http.HandlerFunc(chatMessageHandler.UpdateChatMessage),
		a.service,
	))
	a.mux.Handle("DELETE /api/chat/{messageId}", middleware.NewAuthMiddleware(
		http.HandlerFunc(chatMessageHandler.DeleteChatMessage),
		a.service,
	))
}

func (a *App) ListenAndServe() error {
	go a.hub.Run()
	fmt.Println("start server on", a.config.Addr)
	return a.server.ListenAndServe()
}
