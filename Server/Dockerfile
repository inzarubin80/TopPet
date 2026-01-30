# Сборка из папки Server (контекст = Server/).
# Для Coolify: Dockerfile = Server/Dockerfile, контекст = Server.
# index.html для превью og/twitter берётся из Server/static/index.html.

# -------- Builder --------
FROM golang:1.24 AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
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
COPY --from=builder /app/static/index.html /app/static/index.html
EXPOSE 8080
CMD ["sh", "-c", "/usr/local/bin/goose -dir /app/migrations postgres \"$DATABASE_URL\" up && ./server"]
