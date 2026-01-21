package main

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"toppet/server/internal/app"
)

func main() {
	ctx := context.Background()

	// Load config
	cfg := app.LoadConfigFromEnv()

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
