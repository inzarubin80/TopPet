package main

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"toppet/server/internal/app"
)

func main() {
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
			log.Printf("Successfully loaded .env file from: %s", path)
			envLoaded = true
			break
		}
	}
	if !envLoaded {
		log.Printf("Warning: .env file not found in any of the tried paths: %v", envPaths)
	}

	ctx := context.Background()

	// Load config
	cfg := app.LoadConfigFromEnv()

	// Log secret to verify .env loading (first 8 chars for security)
	secretPreview := cfg.AccessTokenSecret
	if len(secretPreview) > 8 {
		secretPreview = secretPreview[:8] + "..."
	}
	log.Printf("Loaded ACCESS_TOKEN_SECRET: %s (length: %d)", secretPreview, len(cfg.AccessTokenSecret))

	// Connect to database
	dbPool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Create app
	application, err := app.NewApp(ctx, cfg, dbPool)
	if err != nil {
		log.Fatalf("Failed to create app: %v", err)
	}

	// Start server
	if err := application.ListenAndServe(); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
