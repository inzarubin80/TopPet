package context

import (
	"context"
	"time"
)

const (
	// DefaultTimeout для обычных операций
	DefaultTimeout = 30 * time.Second
	// DatabaseTimeout для операций с базой данных
	DatabaseTimeout = 10 * time.Second
	// ExternalAPITimeout для внешних API вызовов
	ExternalAPITimeout = 15 * time.Second
	// UploadTimeout для загрузки файлов
	UploadTimeout = 5 * time.Minute
)

// WithDatabaseTimeout создает контекст с таймаутом для операций с БД
func WithDatabaseTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, DatabaseTimeout)
}

// WithExternalAPITimeout создает контекст с таймаутом для внешних API
func WithExternalAPITimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, ExternalAPITimeout)
}

// WithUploadTimeout создает контекст с таймаутом для загрузки файлов
func WithUploadTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, UploadTimeout)
}

// WithDefaultTimeout создает контекст с таймаутом по умолчанию
func WithDefaultTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, DefaultTimeout)
}
