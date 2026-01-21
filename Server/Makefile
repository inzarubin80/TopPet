LOCAL_BIN:=$(CURDIR)/bin
COMPOSE_FILE := docker-compose.yml
# Подключаем .env (не падаем, если файла нет)
-include .env

# Значение по умолчанию, если в .env не задан DATABASE_URL
DATABASE_URL ?= postgres://postgres:postgres@localhost:5432/toppet?sslmode=disable

.PHONY: .install-sqlc
.install-sqlc:
	$(info Installing sqlc...)
	GOBIN=$(LOCAL_BIN) go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest

.PHONY: .sqlc-generate
.sqlc-generate:
	$(info sqlc-generate...)
	bin/sqlc generate

.PHONY: .install-goose
.install-goose:
	$(info Installing goose...)
	GOBIN=$(LOCAL_BIN) go install github.com/pressly/goose/v3/cmd/goose@v3.22.1

.PHONY: .apply-migrations
.apply-migrations:
	bin/goose -dir migrations postgres "$(DATABASE_URL)" up

.PHONY: .reset-migrations
.reset-migrations:
	bin/goose -dir migrations postgres "$(DATABASE_URL)" down-to 0
	bin/goose -dir migrations postgres "$(DATABASE_URL)" up

MIGRATIONS_DIR=./migrations
.PHONY: create-migration
create-migration:
	@read -p "Введите имя миграции: " name; \
	bin/goose -dir $(MIGRATIONS_DIR) create $$name sql

.PHONY: install-tools
install-tools: .install-sqlc .install-goose
	$(info Tools installed successfully)

.PHONY: setup
setup: install-tools .sqlc-generate
	$(info Setup completed)

.PHONY: migrate
migrate: .apply-migrations
	$(info Migrations applied)

.PHONY: migrate-reset
migrate-reset: .reset-migrations
	$(info Migrations reset and reapplied)

.PHONY: generate
generate: .sqlc-generate
	$(info Code generated)

.PHONY: run
run:
	@echo "Starting server..."
	go run cmd/server/main.go

.PHONY: build
build:
	@echo "Building server..."
	go build -o bin/server cmd/server/main.go

.PHONY: test
test:
	@echo "Running tests..."
	go test ./...

.PHONY: run-all
run-all:
	@echo "Building and starting containers..."
	docker-compose -f $(COMPOSE_FILE) up --build -d

.PHONY: stop
stop:
	@echo "Stopping containers..."
	docker-compose -f $(COMPOSE_FILE) down

.PHONY: logs
logs:
	docker-compose -f $(COMPOSE_FILE) logs -f
