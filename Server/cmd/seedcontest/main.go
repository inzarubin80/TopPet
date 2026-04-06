// Command seedcontest накатывает в БД демо-конкурс (много участников, 3 номинации, 3 критерия, 3 жюри).
//
// Чтобы открыть конкурс в клиенте под своим аккаунтом, укажите ORGANIZER_USER_ID — ваш user_id из таблицы users
// (роль при необходимости будет выставлена в contest_admin).
//
// Пример:
//
//	DATABASE_URL=postgres://... ORGANIZER_USER_ID=1 go run ./cmd/seedcontest
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"toppet/server/integration"
	"toppet/server/internal/model"
)

func main() {
	_ = godotenv.Load("../../.env", "../.env", ".env")

	ctx := context.Background()
	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		dbURL = strings.TrimSpace(os.Getenv("INTEGRATION_DATABASE_URL"))
	}
	if dbURL == "" {
		log.Fatal("set DATABASE_URL (или INTEGRATION_DATABASE_URL)")
	}

	scale := 300
	if s := strings.TrimSpace(os.Getenv("INTEGRATION_SCALE")); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 {
			log.Fatalf("INTEGRATION_SCALE: %v", err)
		}
		scale = n
	}

	var organizerID *model.UserID
	if s := strings.TrimSpace(os.Getenv("ORGANIZER_USER_ID")); s != "" {
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			log.Fatalf("ORGANIZER_USER_ID: %v", err)
		}
		id := model.UserID(n)
		organizerID = &id
	}

	leaveVoting := strings.TrimSpace(os.Getenv("SEED_LEAVE_VOTING")) == "1" ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("SEED_LEAVE_VOTING")), "true")

	title := strings.TrimSpace(os.Getenv("SEED_TITLE"))
	desc := strings.TrimSpace(os.Getenv("SEED_DESCRIPTION"))

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	res, err := integration.SeedLargeContestFlow(ctx, pool, integration.SeedConfig{
		Scale:             scale,
		OrganizerUserID:   organizerID,
		Title:             title,
		Description:       desc,
		LeaveVoting:       leaveVoting,
	})
	if err != nil {
		log.Fatalf("seed: %v", err)
	}

	fmt.Println("--- seedcontest OK ---")
	fmt.Printf("contest_id:   %s\n", res.ContestID)
	fmt.Printf("organizer_id: %d\n", res.OrganizerID)
	fmt.Printf("participants: %d\n", res.Scale)
	fmt.Printf("finished:     %v\n", res.Finished)
	if res.Finished {
		fmt.Printf("jury_winners: %d\n", res.JuryWinnerN)
	}
	fmt.Println("Откройте в клиенте: /contests/" + string(res.ContestID))
	if organizerID == nil {
		fmt.Println("Внимание: организатор создан без OAuth — войти в UI нельзя. Повторите с ORGANIZER_USER_ID=<ваш user_id>.")
	}
}
