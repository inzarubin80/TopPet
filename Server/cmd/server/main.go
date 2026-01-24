package main

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"toppet/server/internal/app"
	"toppet/server/internal/app/logger"
)

func main() {
	// Initialize structured logger
	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info"
	}
	logJSON := os.Getenv("LOG_JSON") == "true"
	logger.InitLogger(logLevel, logJSON)

	// Load .env file
	// Try multiple paths for different launch scenarios:
	// - ../../.env: when running from cmd/server/ directory (Server/.env)
	// - ../.env: when running from Server/ directory
	// - ./cmd/server/.env: when .env is next to main.go
	// - Server/.env: when running from TopPet/ root directory
	// - .env: when running from Server/ directory (current working dir)
	var envPaths = []string{"../../.env", "../.env", "./cmd/server/.env", "Server/.env", ".env"}
	var envLoaded bool
	for _, path := range envPaths {
		if err := godotenv.Load(path); err == nil {
			logger.Info("Successfully loaded .env file", "path", path)
			envLoaded = true
			break
		}
	}
	if !envLoaded {
		logger.Warn("Warning: .env file not found", "paths", envPaths)
	}

	ctx := context.Background()

	// Load config
	cfg := app.LoadConfigFromEnv()

	// Validate config
	if err := app.ValidateConfig(cfg); err != nil {
		logger.Error("Invalid configuration", "error", err)
		log.Fatalf("Invalid configuration: %v", err)
	}

	// Log secret to verify .env loading (first 8 chars for security)
	secretPreview := cfg.AccessTokenSecret
	if len(secretPreview) > 8 {
		secretPreview = secretPreview[:8] + "..."
	}
	logger.Info("Loaded ACCESS_TOKEN_SECRET", "preview", secretPreview, "length", len(cfg.AccessTokenSecret))

	// Connect to database
	dbPool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("Failed to connect to database", "error", err)
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()
	logger.Info("Database connection established")

	// Create app
	application, err := app.NewApp(ctx, cfg, dbPool)
	if err != nil {
		logger.Error("Failed to create app", "error", err)
		log.Fatalf("Failed to create app: %v", err)
	}

	// Start server
	logger.Info("Starting server", "addr", cfg.Addr)
	if err := application.ListenAndServe(); err != nil {
		logger.Error("Server error", "error", err)
		log.Fatalf("Server error: %v", err)
	}
}
