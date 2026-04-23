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
	"toppet/server/internal/legal"
	"toppet/server/internal/model"
	"toppet/server/internal/repository"
	"toppet/server/internal/service"
	"toppet/server/internal/storage/objectstorage"
)

const (
	readHeaderTimeoutSeconds = 30
	readTimeoutSeconds       = 600 // Увеличено до 10 минут для загрузки больших файлов (видео)
	writeTimeoutSeconds      = 600 // Увеличено до 10 минут для загрузки больших файлов (видео)
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
		userHub           *ws.UserHub
		uploader          *objectstorage.Uploader
		store             *sessions.CookieStore
		loginStateStore   map[string]appHttp.StateData
		loginStateStoreMu sync.Mutex
		legalDocs         *legal.Store
	}
)

func NewApp(ctx context.Context, config Config, dbConn *pgxpool.Pool) (*App, error) {
	mux := http.NewServeMux()
	hub := ws.NewHub()
	userHub := ws.NewUserHub()

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

	legalStore, err := legal.Load()
	if err != nil {
		return nil, err
	}

	// Build service
	topPetService := service.NewTopPetService(repo, hub, userHub, accessTokenService, refreshTokenService, providersMap, legalStore)
	userHub.SetPresenceOnChange(func(uid model.UserID, online bool) {
		_ = topPetService.BroadcastDirectMessagePeerPresence(context.Background(), uid, online)
	})

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
		userHub:           userHub,
		uploader:          uploader,
		store:             store,
		loginStateStore:   make(map[string]appHttp.StateData),
		loginStateStoreMu: sync.Mutex{},
		legalDocs:         legalStore,
	}

	app.registerRoutes()

	// SPA meta HTML for crawlers (og/twitter). Routes always registered; handler returns 404 when SPA_INDEX_PATH is not set.
	metaHandler := appHttp.NewMetaHTMLHandler(config.BaseURL, config.SPAIndexPath, topPetService)
	mux.Handle("GET /contests/{contestId}/participants/{participantId}", http.HandlerFunc(metaHandler.ServeParticipant))
	mux.Handle("GET /contests/{contestId}/participants/{participantId}/", http.HandlerFunc(metaHandler.ServeParticipant))
	mux.Handle("GET /contests/{contestId}", http.HandlerFunc(metaHandler.ServeContest))
	mux.Handle("GET /contests/{contestId}/", http.HandlerFunc(metaHandler.ServeContest))
	mux.Handle("GET /", http.HandlerFunc(metaHandler.ServeHome))

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

	// Legal documents (public markdown)
	a.mux.Handle("GET /api/legal/documents", appHttp.NewListLegalDocumentsHandler("/api/legal/documents", a.legalDocs))
	a.mux.Handle("GET /api/legal/documents/{documentId}", appHttp.NewGetLegalDocumentHandler("/api/legal/documents/{documentId}", a.legalDocs))

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
	a.mux.Handle("DELETE /api/auth/me", middleware.NewAuthMiddleware(
		appHttp.NewDeleteCurrentUserHandler("/api/auth/me", a.service),
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
	a.mux.Handle("POST /api/contests/{contestId}/voting-results/recalculate", middleware.NewAuthMiddleware(
		appHttp.NewRecalculateVotingResultsHandler("/api/contests/{contestId}/voting-results/recalculate", a.service),
		a.service,
	))

	a.mux.Handle("GET /api/contests/{contestId}/nominations", appHttp.NewNominationsHandler("/api/contests/{contestId}/nominations", a.service))
	a.mux.Handle("POST /api/contests/{contestId}/nominations", middleware.NewAuthMiddleware(
		appHttp.NewNominationsHandler("/api/contests/{contestId}/nominations", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/contests/{contestId}/nominations/{nominationId}", middleware.NewAuthMiddleware(
		appHttp.NewPatchNominationHandler("/api/contests/{contestId}/nominations/{nominationId}", a.service),
		a.service,
	))
	a.mux.Handle("DELETE /api/contests/{contestId}/nominations/{nominationId}", middleware.NewAuthMiddleware(
		appHttp.NewDeleteNominationHandler("/api/contests/{contestId}/nominations/{nominationId}", a.service),
		a.service,
	))
	a.mux.Handle("PUT /api/contests/{contestId}/nominations/order", middleware.NewAuthMiddleware(
		appHttp.NewPutNominationOrderHandler("/api/contests/{contestId}/nominations/order", a.service),
		a.service,
	))

	a.mux.Handle("GET /api/contests/{contestId}/jury-criteria", appHttp.NewJuryCriteriaListHandler("/api/contests/{contestId}/jury-criteria", a.service))
	a.mux.Handle("PUT /api/contests/{contestId}/jury-criteria", middleware.NewAuthMiddleware(
		appHttp.NewJuryCriteriaReplaceHandler("/api/contests/{contestId}/jury-criteria", a.service),
		a.service,
	))

	a.mux.Handle("GET /api/contests/{contestId}/jury", appHttp.NewContestJuryListHandler("/api/contests/{contestId}/jury", a.service))
	a.mux.Handle("POST /api/contests/{contestId}/jury", middleware.NewAuthMiddleware(
		appHttp.NewContestJuryAddHandler("/api/contests/{contestId}/jury", a.service),
		a.service,
	))
	a.mux.Handle("DELETE /api/contests/{contestId}/jury/{userId}", middleware.NewAuthMiddleware(
		appHttp.NewContestJuryRemoveHandler("/api/contests/{contestId}/jury/{userId}", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/contests/{contestId}/jury/{userId}", middleware.NewAuthMiddleware(
		appHttp.NewContestJuryPatchHandler("/api/contests/{contestId}/jury/{userId}", a.service),
		a.service,
	))
	a.mux.Handle("PUT /api/contests/{contestId}/jury/order", middleware.NewAuthMiddleware(
		appHttp.NewContestJuryReorderHandler("/api/contests/{contestId}/jury/order", a.service),
		a.service,
	))

	a.mux.Handle("GET /api/admin/users", middleware.NewAuthMiddleware(
		appHttp.NewAdminUsersListHandler("/api/admin/users", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/admin/users/{userId}", middleware.NewAuthMiddleware(
		appHttp.NewAdminUserPatchHandler("/api/admin/users/{userId}", a.service),
		a.service,
	))

	a.mux.Handle("GET /api/users/search", middleware.NewAuthMiddleware(
		appHttp.NewUsersSearchHandler("/api/users/search", a.service),
		a.service,
	))

	a.mux.Handle("GET /api/contests/{contestId}/registration-fields", appHttp.NewRegistrationFieldsListHandler("/api/contests/{contestId}/registration-fields", a.service))
	a.mux.Handle("PUT /api/contests/{contestId}/registration-fields", middleware.NewAuthMiddleware(
		appHttp.NewRegistrationFieldsReplaceHandler("/api/contests/{contestId}/registration-fields", a.service),
		a.service,
	))

	// Participants (public)
	a.mux.Handle("GET /api/contests/{contestId}/participants", appHttp.NewListParticipantsHandler("/api/contests/{contestId}/participants", a.service))
	a.mux.Handle("GET /api/contests/{contestId}/participants/{participantId}", appHttp.NewGetParticipantHandler("/api/contests/{contestId}/participants/{participantId}", a.service))
	a.mux.Handle("GET /api/contests/{contestId}/participants/{participantId}/voters", appHttp.NewParticipantVotersHandler("/api/contests/{contestId}/participants/{participantId}/voters", a.service))
	a.mux.Handle("GET /api/contests/{contestId}/jury-voting-progress", middleware.NewAuthMiddleware(
		appHttp.NewJuryVotingProgressHandler("/api/contests/{contestId}/jury-voting-progress", a.service),
		a.service,
	))
	a.mux.Handle("GET /api/contests/{contestId}/jury-chairboard", middleware.NewAuthMiddleware(
		appHttp.NewJuryChairboardHandler("/api/contests/{contestId}/jury-chairboard", a.service),
		a.service,
	))
	a.mux.Handle("PUT /api/contests/{contestId}/jury-chair-assignments", middleware.NewAuthMiddleware(
		appHttp.NewJuryChairAssignmentsHandler("/api/contests/{contestId}/jury-chair-assignments", a.service),
		a.service,
	))
	a.mux.Handle("GET /api/contests/{contestId}/participants/{participantId}/jury-scores-report", middleware.NewAuthMiddleware(
		appHttp.NewJuryScoresReportHandler("/api/contests/{contestId}/participants/{participantId}/jury-scores-report", a.service),
		a.service,
	))
	a.mux.Handle("GET /api/contests/{contestId}/participants/{participantId}/my-jury-scores", middleware.NewAuthMiddleware(
		appHttp.NewMyJuryScoresHandler("/api/contests/{contestId}/participants/{participantId}/my-jury-scores", a.service),
		a.service,
	))
	a.mux.Handle("PUT /api/contests/{contestId}/participants/{participantId}/my-jury-scores", middleware.NewAuthMiddleware(
		appHttp.NewMyJuryScoresHandler("/api/contests/{contestId}/participants/{participantId}/my-jury-scores", a.service),
		a.service,
	))
	a.mux.Handle("PUT /api/contests/{contestId}/participants/{participantId}/favorite", middleware.NewAuthMiddleware(
		appHttp.NewPutParticipantFavoriteHandler("/api/contests/{contestId}/participants/{participantId}/favorite", a.service),
		a.service,
	))

	// Participants (auth required)
	a.mux.Handle("POST /api/contests/{contestId}/participants", middleware.NewAuthMiddleware(
		appHttp.NewCreateParticipantHandler("/api/contests/{contestId}/participants", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/participants/{participantId}", middleware.NewAuthMiddleware(
		appHttp.NewUpdateParticipantHandler("/api/participants/{participantId}", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/participants/{participantId}/submission", middleware.NewAuthMiddleware(
		appHttp.NewPatchParticipantSubmissionHandler("/api/participants/{participantId}/submission", a.service),
		a.service,
	))
	a.mux.Handle("DELETE /api/participants/{participantId}", middleware.NewAuthMiddleware(
		appHttp.NewDeleteParticipantHandler("/api/participants/{participantId}", a.service),
		a.service,
	))
	if a.uploader != nil {
		a.mux.Handle("POST /api/auth/me/upload-avatar", middleware.NewAuthMiddleware(
			appHttp.NewUploadUserAvatarHandler("/api/auth/me/upload-avatar", a.service, a.uploader),
			a.service,
		))
		a.mux.Handle("POST /api/contests/{contestId}/assets/{kind}", middleware.NewAuthMiddleware(
			appHttp.NewUploadContestAssetHandler("/api/contests/{contestId}/assets/{kind}", a.service, a.uploader),
			a.service,
		))
		a.mux.Handle("POST /api/contests/{contestId}/nominations/{nominationId}/logo", middleware.NewAuthMiddleware(
			appHttp.NewUploadNominationLogoHandler("/api/contests/{contestId}/nominations/{nominationId}/logo", a.service, a.uploader),
			a.service,
		))
		a.mux.Handle("DELETE /api/contests/{contestId}/nominations/{nominationId}/logo", middleware.NewAuthMiddleware(
			appHttp.NewUploadNominationLogoHandler("/api/contests/{contestId}/nominations/{nominationId}/logo", a.service, a.uploader),
			a.service,
		))
		a.mux.Handle("POST /api/contests/{contestId}/registration-image-upload", middleware.NewAuthMiddleware(
			appHttp.NewUploadRegistrationFieldImageHandler("/api/contests/{contestId}/registration-image-upload", a.service, a.uploader),
			a.service,
		))
		a.mux.Handle("POST /api/participants/{participantId}/photos", middleware.NewAuthMiddleware(
			appHttp.NewUploadPhotoHandler("/api/participants/{participantId}/photos", a.service, a.uploader),
			a.service,
		))
		a.mux.Handle("POST /api/contests/{contestId}/chat/upload-image", middleware.NewAuthMiddleware(
			appHttp.NewUploadChatMessageImageHandler("/api/contests/{contestId}/chat/upload-image", a.service, a.uploader),
			a.service,
		))
		a.mux.Handle("POST /api/participants/{participantId}/comments/upload-image", middleware.NewAuthMiddleware(
			appHttp.NewUploadCommentImageHandler("/api/participants/{participantId}/comments/upload-image", a.service, a.uploader),
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
	a.mux.Handle("POST /api/comments/{commentId}/vote", middleware.NewAuthMiddleware(
		http.HandlerFunc(commentsHandler.VoteComment),
		a.service,
	))
	a.mux.Handle("POST /api/participants/{participantId}/staff-comments/mark-read", middleware.NewAuthMiddleware(
		appHttp.NewMarkStaffCommentsReadHandler("/api/participants/{participantId}/staff-comments/mark-read", a.service),
		a.service,
	))
	a.mux.Handle("GET /api/me/staff-comment-notifications", middleware.NewAuthMiddleware(
		appHttp.NewStaffCommentNotificationsHandler("/api/me/staff-comment-notifications", a.service),
		a.service,
	))
	a.mux.Handle("GET /api/me/notifications", middleware.NewAuthMiddleware(
		appHttp.NewUserNotificationsListHandler("/api/me/notifications", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/me/notifications/{notificationId}", middleware.NewAuthMiddleware(
		appHttp.NewUserNotificationPatchHandler("/api/me/notifications/{notificationId}", a.service),
		a.service,
	))
	a.mux.Handle("POST /api/me/notifications/read-all", middleware.NewAuthMiddleware(
		appHttp.NewUserNotificationsReadAllHandler("/api/me/notifications/read-all", a.service),
		a.service,
	))
	a.mux.Handle("GET /api/me/dm/conversations", middleware.NewAuthMiddleware(
		appHttp.NewDirectConversationsHandler("/api/me/dm/conversations", a.service),
		a.service,
	))
	a.mux.Handle("POST /api/me/dm/conversations", middleware.NewAuthMiddleware(
		appHttp.NewDirectConversationsHandler("/api/me/dm/conversations", a.service),
		a.service,
	))
	a.mux.Handle("GET /api/me/dm/{conversationId}/messages", middleware.NewAuthMiddleware(
		appHttp.NewDirectConversationMessagesHandler("/api/me/dm/{conversationId}/messages", a.service),
		a.service,
	))
	a.mux.Handle("POST /api/me/dm/{conversationId}/messages", middleware.NewAuthMiddleware(
		appHttp.NewDirectConversationMessagesHandler("/api/me/dm/{conversationId}/messages", a.service),
		a.service,
	))
	a.mux.Handle("PATCH /api/me/dm/{conversationId}/messages/{messageId}", middleware.NewAuthMiddleware(
		appHttp.NewDirectMessageHandler("/api/me/dm/{conversationId}/messages/{messageId}", a.service),
		a.service,
	))
	a.mux.Handle("DELETE /api/me/dm/{conversationId}/messages/{messageId}", middleware.NewAuthMiddleware(
		appHttp.NewDirectMessageHandler("/api/me/dm/{conversationId}/messages/{messageId}", a.service),
		a.service,
	))
	a.mux.Handle("DELETE /api/me/dm/{conversationId}", middleware.NewAuthMiddleware(
		appHttp.NewDirectConversationDeleteHandler("/api/me/dm/{conversationId}", a.service),
		a.service,
	))
	a.mux.Handle("GET /api/me/notifications/ws", appHttp.NewUserNotificationsWSHandler("/api/me/notifications/ws", a.service, a.service, a.userHub))

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
	a.mux.Handle("POST /api/chat/{messageId}/vote", middleware.NewAuthMiddleware(
		http.HandlerFunc(chatMessageHandler.VoteChatMessage),
		a.service,
	))
}

func (a *App) ListenAndServe() error {
	go a.hub.Run()
	go a.userHub.Run()
	if a.config.ContestSchedulerIntervalSec > 0 {
		iv := time.Duration(a.config.ContestSchedulerIntervalSec) * time.Second
		go a.service.RunContestStatusScheduler(context.Background(), iv)
	}
	fmt.Println("start server on", a.config.Addr)
	return a.server.ListenAndServe()
}
