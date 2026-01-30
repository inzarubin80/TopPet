# Сборка из корня репозитория: docker build -f Server/Dockerfile .
# Контекст должен быть корень репозитория (.), чтобы были client/ и Server/.

# -------- Сборка клиента (для index.html) --------
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# -------- Сборка сервера --------
FROM golang:1.24 AS builder
WORKDIR /app
COPY Server/go.mod Server/go.sum ./
RUN go mod download
COPY Server/ ./
RUN go install github.com/pressly/goose/v3/cmd/goose@v3.22.1
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server ./cmd/server/
RUN ls -l /app/server

# -------- Runtime --------
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache libc6-compat ca-certificates
COPY --from=builder /app/server .
COPY --from=builder /app/migrations /app/migrations/
COPY --from=builder /go/bin/goose /usr/local/bin/goose
# index.html встроен в образ (превью og/twitter для ботов)
COPY --from=client-builder /app/build/index.html /app/static/index.html
EXPOSE 8080
CMD ["sh", "-c", "/usr/local/bin/goose -dir /app/migrations postgres \"$DATABASE_URL\" up && ./server"]
