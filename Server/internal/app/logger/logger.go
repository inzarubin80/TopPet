package logger

import (
	"context"
	"log/slog"
	"os"
)

var (
	// Logger is the global structured logger instance
	Logger *slog.Logger
)

// InitLogger инициализирует структурированный логгер
func InitLogger(level string, jsonFormat bool) {
	var logLevel slog.Level
	switch level {
	case "debug":
		logLevel = slog.LevelDebug
	case "info":
		logLevel = slog.LevelInfo
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level: logLevel,
	}

	var handler slog.Handler
	if jsonFormat {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	Logger = slog.New(handler)
}

// Debug логирует сообщение уровня debug
func Debug(msg string, args ...any) {
	Logger.Debug(msg, args...)
}

// Info логирует сообщение уровня info
func Info(msg string, args ...any) {
	Logger.Info(msg, args...)
}

// Warn логирует сообщение уровня warn
func Warn(msg string, args ...any) {
	Logger.Warn(msg, args...)
}

// Error логирует сообщение уровня error
func Error(msg string, args ...any) {
	Logger.Error(msg, args...)
}

// WithContext возвращает логгер с контекстными полями
func WithContext(ctx context.Context) *slog.Logger {
	if Logger == nil {
		// Fallback к стандартному логгеру если не инициализирован
		InitLogger("info", false)
	}
	return Logger
}

// WithFields возвращает логгер с дополнительными полями
func WithFields(args ...any) *slog.Logger {
	if Logger == nil {
		InitLogger("info", false)
	}
	return Logger.With(args...)
}
