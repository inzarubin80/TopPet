package integration

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	tokenservice "toppet/server/internal/app/token_service"
	"toppet/server/internal/model"
	"toppet/server/internal/repository"
	"toppet/server/internal/service"
)

// SeedConfig — накат демо-конкурса (как интеграционный тест 300×3×3×3).
type SeedConfig struct {
	// Scale число участников, кратно 3 (по умолчанию 300).
	Scale int
	// OrganizerUserID — если задан, конкурс создаётся от этого пользователя (нужен вход в UI через OAuth).
	// Иначе создаётся новый пользователь-организатор (войти в клиент будет нельзя без ручной привязки OAuth).
	OrganizerUserID *model.UserID
	Title           string
	Description     string
	// LeaveVoting если true — после выставления оценок остаётся фаза голосования (удобно смотреть отчёт жюри). Иначе конкурс завершается с победителями.
	LeaveVoting bool
}

// SeedResult — идентификаторы после наката.
type SeedResult struct {
	ContestID   model.ContestID
	OrganizerID model.UserID
	Scale       int
	Finished    bool
	JuryWinnerN int
}

// timePtrClone копирует указатель на время.
func timePtrClone(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	tt := *t
	return &tt
}

// ContestUpdateFromModel копирует поля конкурса для PATCH (как merge в HTTP update_contest).
func ContestUpdateFromModel(c *model.Contest) model.ContestUpdate {
	tz := strings.TrimSpace(c.ScheduleTimezone)
	if tz == "" {
		tz = "Europe/Moscow"
	}
	minP := c.MinPhotoCount
	if minP < 1 {
		minP = 1
	}
	maxP := c.MaxPhotoCount
	if maxP < 1 {
		maxP = 30
	}
	if maxP < minP {
		maxP = minP
	}
	return model.ContestUpdate{
		Title:                          c.Title,
		Description:                    c.Description,
		PublicVotingEnabled:            c.PublicVotingEnabled,
		JuryVotingEnabled:              c.JuryVotingEnabled,
		CoverUrl:                       c.CoverUrl,
		Tagline:                        c.Tagline,
		RulesText:                      c.RulesText,
		PrizeText:                      c.PrizeText,
		LogoUrl:                        c.LogoUrl,
		ThemeColor:                     c.ThemeColor,
		SponsorName:                    c.SponsorName,
		SponsorLogoUrl:                 c.SponsorLogoUrl,
		SponsorUrl:                     c.SponsorUrl,
		CtaLabelOverride:               c.CtaLabelOverride,
		ParticipantAllowedEmailDomains: model.JoinParticipantEmailDomainsDB(c.ParticipantAllowedEmailDomains),
		PublicationStartsAt:            timePtrClone(c.PublicationStartsAt),
		RegistrationStartsAt:           timePtrClone(c.RegistrationStartsAt),
		VotingStartsAt:                 timePtrClone(c.VotingStartsAt),
		VotingEndsAt:                   timePtrClone(c.VotingEndsAt),
		ScheduleTimezone:               tz,
		MinPhotoCount:                  minP,
		MaxPhotoCount:                  maxP,
		EntryTitleHint:                 c.EntryTitleHint,
	}
}

// SetContestTierPro выставляет тариф pro (нужно для 3+ членов жюри на free-лимите).
func SetContestTierPro(ctx context.Context, pool *pgxpool.Pool, contestID model.ContestID) error {
	tag, err := pool.Exec(ctx, `UPDATE contests SET tier = $1 WHERE id = $2::uuid`, "pro", string(contestID))
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("set tier pro: expected 1 row, got %d", tag.RowsAffected())
	}
	return nil
}

// NewIntegrationService — сервис с теми же зависимостями, что и сид/интеграционный тест.
func NewIntegrationService(repo *repository.Repository) *service.TopPetService {
	access := tokenservice.NewTokenService([]byte("integration-access-secret-key-32bytes!!"), time.Hour, "access")
	refresh := tokenservice.NewTokenService([]byte("integration-refresh-secret-key-32bytes!"), time.Hour, "refresh")
	return service.NewTopPetService(repo, nil, access, refresh, nil)
}

// SeedLargeContestFlow создаёт конкурс с номинациями, критериями жюри, участниками и оценками.
// Пул не закрывается — закрывает вызывающий код.
func SeedLargeContestFlow(ctx context.Context, pool *pgxpool.Pool, cfg SeedConfig) (*SeedResult, error) {
	if pool == nil {
		return nil, fmt.Errorf("pool is required")
	}
	scale := cfg.Scale
	if scale <= 0 {
		scale = 300
	}
	perNomBase := scale / 3
	perNomRemainder := scale % 3
	perNomCounts := [3]int{perNomBase, perNomBase, perNomBase}
	for i := 0; i < perNomRemainder; i++ {
		perNomCounts[i]++
	}
	title := strings.TrimSpace(cfg.Title)
	if title == "" {
		title = "Демо: большой конкурс (seed)"
	}
	desc := cfg.Description
	if desc == "" {
		desc = "Данные сгенерированы seed-скриптом / интеграционным сценарием."
	}

	repo := repository.NewRepository(pool)
	svc := NewIntegrationService(repo)

	var orgID model.UserID
	if cfg.OrganizerUserID != nil {
		orgID = *cfg.OrganizerUserID
		if _, err := repo.GetUser(ctx, orgID); err != nil {
			return nil, fmt.Errorf("organizer user %d: %w", orgID, err)
		}
		role, err := repo.GetUserRole(ctx, orgID)
		if err != nil {
			return nil, err
		}
		if !model.IsGlobalContestManagerRole(role) {
			if _, err := repo.UpdateUserRole(ctx, orgID, model.UserRoleContestAdmin); err != nil {
				return nil, fmt.Errorf("organizer needs contest_admin role: %w", err)
			}
		}
	} else {
		org, err := repo.CreateUser(ctx, "seed-organizer")
		if err != nil {
			return nil, fmt.Errorf("CreateUser organizer: %w", err)
		}
		if _, err := repo.UpdateUserRole(ctx, org.ID, model.UserRoleContestAdmin); err != nil {
			return nil, fmt.Errorf("UpdateUserRole organizer: %w", err)
		}
		orgID = org.ID
	}

	contest, err := svc.CreateContest(ctx, orgID, title, desc)
	if err != nil {
		return nil, fmt.Errorf("CreateContest: %w", err)
	}
	contestID := contest.ID

	c0, err := svc.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	u := ContestUpdateFromModel(c0)
	u.JuryVotingEnabled = true
	u.PublicVotingEnabled = true
	u.JuryPrizePlaces = []model.ContestPrizePlace{
		{Place: 1, Prize: "Приз за 1 место"},
		{Place: 2, Prize: "Приз за 2 место"},
		{Place: 3, Prize: "Приз за 3 место"},
	}
	u.AudiencePrizePlaces = []model.ContestPrizePlace{
		{Place: 1, Prize: "Приз за 1 место"},
		{Place: 2, Prize: "Приз за 2 место"},
		{Place: 3, Prize: "Приз за 3 место"},
	}
	if _, err := svc.UpdateContest(ctx, contestID, orgID, u); err != nil {
		return nil, fmt.Errorf("UpdateContest flags: %w", err)
	}
	if err := SetContestTierPro(ctx, pool, contestID); err != nil {
		return nil, err
	}

	var nomIDs [3]string
	for i := 0; i < 3; i++ {
		n, err := svc.CreateNomination(ctx, contestID, orgID, fmt.Sprintf("Номинация %d", i+1), "")
		if err != nil {
			return nil, fmt.Errorf("CreateNomination %d: %w", i, err)
		}
		nomIDs[i] = n.ID
	}

	criteria := []*model.JuryCriterionInput{
		{Title: "Критерий 1", Description: "", ScaleMin: 1, ScaleMax: 10, ScaleStep: 1},
		{Title: "Критерий 2", Description: "", ScaleMin: 1, ScaleMax: 10, ScaleStep: 1},
		{Title: "Критерий 3", Description: "", ScaleMin: 1, ScaleMax: 10, ScaleStep: 1},
	}
	if _, err := svc.ReplaceContestJuryCriteria(ctx, contestID, orgID, criteria); err != nil {
		return nil, fmt.Errorf("ReplaceContestJuryCriteria: %w", err)
	}
	crList, err := repo.ListJuryCriteriaByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if len(crList) != 3 {
		return nil, fmt.Errorf("criteria: want 3, got %d", len(crList))
	}

	var juryIDs [3]model.UserID
	for i := 0; i < 3; i++ {
		j, err := repo.CreateUser(ctx, fmt.Sprintf("seed-juror-%d", i+1))
		if err != nil {
			return nil, fmt.Errorf("CreateUser juror: %w", err)
		}
		juryIDs[i] = j.ID
		if _, err := svc.AddContestJuryMember(ctx, contestID, orgID, j.ID); err != nil {
			return nil, fmt.Errorf("AddContestJuryMember %d: %w", i, err)
		}
	}

	if _, err := svc.UpdateContestStatus(ctx, contestID, orgID, model.ContestStatusRegistration); err != nil {
		return nil, fmt.Errorf("UpdateContestStatus registration: %w", err)
	}

	participantIDs := make([]model.ParticipantID, scale)
	participantNomIdx := make([]int, scale)
	participantPosInNom := make([]int, scale)
	nomCurrentCounts := [3]int{}
	participantIDsByNom := [3][]model.ParticipantID{}
	for i := 0; i < scale; i++ {
		owner, err := repo.CreateUser(ctx, fmt.Sprintf("seed-participant-user-%d", i))
		if err != nil {
			return nil, fmt.Errorf("CreateUser participant owner %d: %w", i, err)
		}
		nomIdx := 0
		switch {
		case nomCurrentCounts[0] < perNomCounts[0]:
			nomIdx = 0
		case nomCurrentCounts[1] < perNomCounts[1]:
			nomIdx = 1
		default:
			nomIdx = 2
		}
		posInNom := nomCurrentCounts[nomIdx]
		nomCurrentCounts[nomIdx]++
		nid := nomIDs[nomIdx]
		petName := fmt.Sprintf("Питомец %d", i)
		authorLabel := fmt.Sprintf("Автор %d", i)
		p, err := svc.CreateParticipant(ctx, contestID, owner.ID, petName, "описание", authorLabel, nil, &nid, "seed-v1", "127.0.0.1", "integration-seed")
		if err != nil {
			return nil, fmt.Errorf("CreateParticipant %d: %w", i, err)
		}
		participantIDs[i] = p.ID
		participantNomIdx[i] = nomIdx
		participantPosInNom[i] = posInNom
		participantIDsByNom[nomIdx] = append(participantIDsByNom[nomIdx], p.ID)
		dummyURL := fmt.Sprintf("https://example.invalid/photo-%d.jpg", i)
		if _, err := svc.AddParticipantPhoto(ctx, p.ID, owner.ID, dummyURL, nil); err != nil {
			return nil, fmt.Errorf("AddParticipantPhoto %d: %w", i, err)
		}
		if _, err := svc.SetParticipantSubmissionStatus(ctx, p.ID, orgID, model.ParticipantSubmissionAccepted, nil); err != nil {
			return nil, fmt.Errorf("SetParticipantSubmissionStatus %d: %w", i, err)
		}
	}

	if _, err := svc.UpdateContestStatus(ctx, contestID, orgID, model.ContestStatusVoting); err != nil {
		return nil, fmt.Errorf("UpdateContestStatus voting: %w", err)
	}

	votersByNom := [3][]model.UserID{}
	for n := 0; n < 3; n++ {
		for v := 0; v < 24; v++ {
			voter, err := repo.CreateUser(ctx, fmt.Sprintf("seed-audience-voter-n%d-%d", n+1, v+1))
			if err != nil {
				return nil, fmt.Errorf("CreateUser audience voter n=%d i=%d: %w", n, v, err)
			}
			votersByNom[n] = append(votersByNom[n], voter.ID)
		}
	}

	for i := 0; i < scale; i++ {
		posInNom := participantPosInNom[i]
		var score int32 = 1
		switch {
		case posInNom <= 2:
			score = 10
		case posInNom <= 4:
			score = 9
		case posInNom <= 6:
			score = 8
		default:
			score = 2
		}
		items := []model.JuryScorePutItem{
			{CriterionID: crList[0].ID, Score: score},
			{CriterionID: crList[1].ID, Score: score},
			{CriterionID: crList[2].ID, Score: score},
		}
		for j := 0; j < 3; j++ {
			if _, err := svc.PutMyJuryScoresForParticipant(ctx, contestID, participantIDs[i], juryIDs[j], items); err != nil {
				return nil, fmt.Errorf("PutMyJuryScores participant %d juror %d: %w", i, j, err)
			}
		}
	}

	for nomIdx := 0; nomIdx < 3; nomIdx++ {
		nomParticipants := participantIDsByNom[nomIdx]
		if len(nomParticipants) < 6 {
			continue
		}
		votePlan := []struct {
			participant model.ParticipantID
			votes       int
		}{
			{participant: nomParticipants[0], votes: 6},
			{participant: nomParticipants[1], votes: 6},
			{participant: nomParticipants[2], votes: 5},
			{participant: nomParticipants[3], votes: 5},
			{participant: nomParticipants[4], votes: 4},
			{participant: nomParticipants[5], votes: 4},
		}
		voters := votersByNom[nomIdx]
		vIdx := 0
		for _, vp := range votePlan {
			for c := 0; c < vp.votes; c++ {
				if vIdx >= len(voters) {
					break
				}
				if _, err := svc.Vote(ctx, contestID, vp.participant, voters[vIdx]); err != nil {
					return nil, fmt.Errorf("Vote nom=%d participant=%s voterIdx=%d: %w", nomIdx, vp.participant, vIdx, err)
				}
				vIdx++
			}
		}
	}

	res := &SeedResult{
		ContestID:   contestID,
		OrganizerID: orgID,
		Scale:       scale,
		Finished:    !cfg.LeaveVoting,
	}

	if cfg.LeaveVoting {
		return res, nil
	}

	if _, err := svc.FinishContest(ctx, contestID, orgID); err != nil {
		return nil, fmt.Errorf("FinishContest: %w", err)
	}
	finished, err := svc.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	res.JuryWinnerN = len(finished.JuryWinners)
	return res, nil
}

// SeedJuryAndAudienceResult — конкурс с голосованием жюри и зрителей (для интеграционного теста).
type SeedJuryAndAudienceResult struct {
	ContestID                   model.ContestID
	OrganizerID                 model.UserID
	ParticipantIDs              []model.ParticipantID
	JuryWinnerParticipantID     model.ParticipantID
	AudienceWinnerParticipantID model.ParticipantID
	// AudienceVoteCount ожидаемое число голосов у победителя зрителей (все в одну работу).
	AudienceVoteCount int64
	// JuryWinnerScore ожидаемая сумма баллов жюри у победителя жюри.
	JuryWinnerScore int64
}

// SeedJuryAndAudienceFlow создаёт один конкурс: 3 участника в одной номинации, 3 критерия, 3 члена жюри,
// голосование зрителей включено. Жюри максимально оценивает первого участника; зрители отдают все голоса третьему.
// Конкурс остаётся в статусе «голосование» — завершение и проверка победителей выполняются в тесте.
func SeedJuryAndAudienceFlow(ctx context.Context, pool *pgxpool.Pool) (*SeedJuryAndAudienceResult, error) {
	if pool == nil {
		return nil, fmt.Errorf("pool is required")
	}
	repo := repository.NewRepository(pool)
	svc := NewIntegrationService(repo)

	org, err := repo.CreateUser(ctx, "seed-jury-aud-org")
	if err != nil {
		return nil, fmt.Errorf("CreateUser organizer: %w", err)
	}
	if _, err := repo.UpdateUserRole(ctx, org.ID, model.UserRoleContestAdmin); err != nil {
		return nil, fmt.Errorf("UpdateUserRole organizer: %w", err)
	}
	orgID := org.ID

	contest, err := svc.CreateContest(ctx, orgID, "Интеграция: жюри + зрители", "Сценарий для теста голосования.")
	if err != nil {
		return nil, fmt.Errorf("CreateContest: %w", err)
	}
	contestID := contest.ID

	c0, err := svc.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	u := ContestUpdateFromModel(c0)
	u.JuryVotingEnabled = true
	u.PublicVotingEnabled = true
	if _, err := svc.UpdateContest(ctx, contestID, orgID, u); err != nil {
		return nil, fmt.Errorf("UpdateContest flags: %w", err)
	}
	if err := SetContestTierPro(ctx, pool, contestID); err != nil {
		return nil, err
	}

	nom, err := svc.CreateNomination(ctx, contestID, orgID, "Единственная номинация", "")
	if err != nil {
		return nil, fmt.Errorf("CreateNomination: %w", err)
	}
	nomID := nom.ID

	criteria := []*model.JuryCriterionInput{
		{Title: "Критерий A", Description: "", ScaleMin: 1, ScaleMax: 10, ScaleStep: 1},
		{Title: "Критерий B", Description: "", ScaleMin: 1, ScaleMax: 10, ScaleStep: 1},
		{Title: "Критерий C", Description: "", ScaleMin: 1, ScaleMax: 10, ScaleStep: 1},
	}
	if _, err := svc.ReplaceContestJuryCriteria(ctx, contestID, orgID, criteria); err != nil {
		return nil, fmt.Errorf("ReplaceContestJuryCriteria: %w", err)
	}
	crList, err := repo.ListJuryCriteriaByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if len(crList) != 3 {
		return nil, fmt.Errorf("criteria: want 3, got %d", len(crList))
	}

	var juryIDs [3]model.UserID
	for i := 0; i < 3; i++ {
		j, err := repo.CreateUser(ctx, fmt.Sprintf("seed-ja-juror-%d", i+1))
		if err != nil {
			return nil, fmt.Errorf("CreateUser juror: %w", err)
		}
		juryIDs[i] = j.ID
		if _, err := svc.AddContestJuryMember(ctx, contestID, orgID, j.ID); err != nil {
			return nil, fmt.Errorf("AddContestJuryMember %d: %w", i, err)
		}
	}

	if _, err := svc.UpdateContestStatus(ctx, contestID, orgID, model.ContestStatusRegistration); err != nil {
		return nil, fmt.Errorf("UpdateContestStatus registration: %w", err)
	}

	participantIDs := make([]model.ParticipantID, 3)
	for i := 0; i < 3; i++ {
		owner, err := repo.CreateUser(ctx, fmt.Sprintf("seed-ja-participant-owner-%d", i))
		if err != nil {
			return nil, fmt.Errorf("CreateUser participant owner %d: %w", i, err)
		}
		petName := fmt.Sprintf("Участник %d", i+1)
		authorLabel := fmt.Sprintf("Автор %d", i)
		p, err := svc.CreateParticipant(ctx, contestID, owner.ID, petName, "описание", authorLabel, nil, &nomID, "seed-v1", "127.0.0.1", "integration-seed")
		if err != nil {
			return nil, fmt.Errorf("CreateParticipant %d: %w", i, err)
		}
		participantIDs[i] = p.ID
		dummyURL := fmt.Sprintf("https://example.invalid/ja-photo-%d.jpg", i)
		if _, err := svc.AddParticipantPhoto(ctx, p.ID, owner.ID, dummyURL, nil); err != nil {
			return nil, fmt.Errorf("AddParticipantPhoto %d: %w", i, err)
		}
		if _, err := svc.SetParticipantSubmissionStatus(ctx, p.ID, orgID, model.ParticipantSubmissionAccepted, nil); err != nil {
			return nil, fmt.Errorf("SetParticipantSubmissionStatus %d: %w", i, err)
		}
	}

	if _, err := svc.UpdateContestStatus(ctx, contestID, orgID, model.ContestStatusVoting); err != nil {
		return nil, fmt.Errorf("UpdateContestStatus voting: %w", err)
	}

	scoreForIndex := func(idx int) int32 {
		switch idx {
		case 0:
			return 10
		case 1:
			return 5
		default:
			return 3
		}
	}

	for i := 0; i < 3; i++ {
		s := scoreForIndex(i)
		items := []model.JuryScorePutItem{
			{CriterionID: crList[0].ID, Score: s},
			{CriterionID: crList[1].ID, Score: s},
			{CriterionID: crList[2].ID, Score: s},
		}
		for j := 0; j < 3; j++ {
			if _, err := svc.PutMyJuryScoresForParticipant(ctx, contestID, participantIDs[i], juryIDs[j], items); err != nil {
				return nil, fmt.Errorf("PutMyJuryScores participant %d juror %d: %w", i, j, err)
			}
		}
	}

	const nVoters = 5
	for v := 0; v < nVoters; v++ {
		voter, err := repo.CreateUser(ctx, fmt.Sprintf("seed-ja-voter-%d", v))
		if err != nil {
			return nil, fmt.Errorf("CreateUser voter %d: %w", v, err)
		}
		if _, err := svc.Vote(ctx, contestID, participantIDs[2], voter.ID); err != nil {
			return nil, fmt.Errorf("Vote voter %d: %w", v, err)
		}
	}

	// 3 критерия × 10 × 3 члена жюри
	const juryWinnerScore int64 = 3 * 10 * 3

	return &SeedJuryAndAudienceResult{
		ContestID:                   contestID,
		OrganizerID:                 orgID,
		ParticipantIDs:              participantIDs,
		JuryWinnerParticipantID:     participantIDs[0],
		AudienceWinnerParticipantID: participantIDs[2],
		AudienceVoteCount:           nVoters,
		JuryWinnerScore:             juryWinnerScore,
	}, nil
}
