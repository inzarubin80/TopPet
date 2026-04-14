package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"toppet/server/internal/model"
	sqlc_repository "toppet/server/internal/repository_sqlc"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func pgTimestamptzToTimePtr(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time.UTC()
	return &t
}

func timePtrToPgTimestamptz(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func contestFromSQLc(c *sqlc_repository.Contest) *model.Contest {
	var idStr string
	if c.ID.Valid {
		idStr = uuid.UUID(c.ID.Bytes).String()
	}
	return &model.Contest{
		ID:                             model.ContestID(idStr),
		CreatedByUserID:                model.UserID(c.CreatedByUserID),
		Title:                          c.Title,
		Description:                    c.Description,
		Status:                         model.ContestStatus(c.Status),
		Tier:                           c.Tier,
		PublicVotingEnabled:            c.PublicVotingEnabled,
		JuryVotingEnabled:              c.JuryVotingEnabled,
		CoverUrl:                       c.CoverUrl,
		Tagline:                        c.Tagline,
		RulesText:                      c.RulesText,
		PrizeText:                      c.PrizeText,
		JuryPrizePlaces:                parseContestPrizePlaces(c.JuryPrizePlaces),
		AudiencePrizePlaces:            parseContestPrizePlaces(c.AudiencePrizePlaces),
		LogoUrl:                        c.LogoUrl,
		ThemeColor:                     c.ThemeColor,
		SponsorName:                    c.SponsorName,
		SponsorLogoUrl:                 c.SponsorLogoUrl,
		SponsorUrl:                     c.SponsorUrl,
		CtaLabelOverride:               c.CtaLabelOverride,
		ParticipantAllowedEmailDomains: model.ParseParticipantEmailDomainsDB(c.ParticipantAllowedEmailDomains),
		PublicationStartsAt:            pgTimestamptzToTimePtr(c.PublicationStartsAt),
		RegistrationStartsAt:           pgTimestamptzToTimePtr(c.RegistrationStartsAt),
		VotingStartsAt:                 pgTimestamptzToTimePtr(c.VotingStartsAt),
		VotingEndsAt:                   pgTimestamptzToTimePtr(c.VotingEndsAt),
		ScheduleTimezone:               c.ScheduleTimezone,
		MinPhotoCount:                  int(c.MinPhotoCount),
		MaxPhotoCount:                  int(c.MaxPhotoCount),
		EntryTitleHint:                 c.EntryTitleHint,
		CreatedAt:                      c.CreatedAt.Time,
		UpdatedAt:                      c.UpdatedAt.Time,
	}
}

func parseContestPrizePlaces(raw []byte) []model.ContestPrizePlace {
	if len(raw) == 0 {
		return []model.ContestPrizePlace{}
	}
	var places []model.ContestPrizePlace
	if err := json.Unmarshal(raw, &places); err != nil {
		return []model.ContestPrizePlace{}
	}
	sort.Slice(places, func(i, j int) bool { return places[i].Place < places[j].Place })
	return places
}

func contestPrizePlacesBytes(places []model.ContestPrizePlace) ([]byte, error) {
	if len(places) == 0 {
		return []byte("[]"), nil
	}
	return json.Marshal(places)
}

func (r *Repository) CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID := uuid.New()

	contest, err := reposqlc.CreateContest(ctx, &sqlc_repository.CreateContestParams{
		ID:              pgtype.UUID{Bytes: contestUUID, Valid: true},
		CreatedByUserID: int64(userID),
		Title:           title,
		Description:     description,
		Status:          string(model.ContestStatusDraft),
	})
	if err != nil {
		return nil, err
	}

	return contestFromSQLc(contest), nil
}

func (r *Repository) GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	contest, err := reposqlc.GetContestByID(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %v", model.ErrorNotFound, err)
		}
		return nil, err
	}

	return contestFromSQLc(contest), nil
}

func (r *Repository) ListContests(ctx context.Context, status *model.ContestStatus, limit, offset int) ([]*model.Contest, int64, error) {
	reposqlc := sqlc_repository.New(r.conn)

	var statusStr string
	if status != nil {
		statusStr = string(*status)
	}

	contests, err := reposqlc.ListContests(ctx, &sqlc_repository.ListContestsParams{
		Column1: statusStr,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := reposqlc.CountContests(ctx, statusStr)
	if err != nil {
		return nil, 0, err
	}

	result := make([]*model.Contest, len(contests))
	for i, c := range contests {
		result[i] = contestFromSQLc(c)
	}

	return result, total, nil
}

func (r *Repository) UpdateContest(ctx context.Context, contestID model.ContestID, u model.ContestUpdate) (*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}
	juryPrizePlacesJSON, err := contestPrizePlacesBytes(u.JuryPrizePlaces)
	if err != nil {
		return nil, err
	}
	audiencePrizePlacesJSON, err := contestPrizePlacesBytes(u.AudiencePrizePlaces)
	if err != nil {
		return nil, err
	}

	contest, err := reposqlc.UpdateContest(ctx, &sqlc_repository.UpdateContestParams{
		ID:                             pgtype.UUID{Bytes: contestUUID, Valid: true},
		Title:                          u.Title,
		Description:                    u.Description,
		PublicVotingEnabled:            u.PublicVotingEnabled,
		JuryVotingEnabled:              u.JuryVotingEnabled,
		CoverUrl:                       u.CoverUrl,
		Tagline:                        u.Tagline,
		RulesText:                      u.RulesText,
		PrizeText:                      u.PrizeText,
		JuryPrizePlaces:                juryPrizePlacesJSON,
		AudiencePrizePlaces:            audiencePrizePlacesJSON,
		LogoUrl:                        u.LogoUrl,
		ThemeColor:                     u.ThemeColor,
		SponsorName:                    u.SponsorName,
		SponsorLogoUrl:                 u.SponsorLogoUrl,
		SponsorUrl:                     u.SponsorUrl,
		CtaLabelOverride:               u.CtaLabelOverride,
		PublicationStartsAt:            timePtrToPgTimestamptz(u.PublicationStartsAt),
		RegistrationStartsAt:           timePtrToPgTimestamptz(u.RegistrationStartsAt),
		VotingStartsAt:                 timePtrToPgTimestamptz(u.VotingStartsAt),
		VotingEndsAt:                   timePtrToPgTimestamptz(u.VotingEndsAt),
		ParticipantAllowedEmailDomains: u.ParticipantAllowedEmailDomains,
		ScheduleTimezone:               u.ScheduleTimezone,
		MinPhotoCount:                  int32(u.MinPhotoCount),
		MaxPhotoCount:                  int32(u.MaxPhotoCount),
		EntryTitleHint:                 u.EntryTitleHint,
	})
	if err != nil {
		return nil, err
	}

	return contestFromSQLc(contest), nil
}

func (r *Repository) SyncNominationPhotoCountsByContest(ctx context.Context, contestID model.ContestID, minPhotoCount, maxPhotoCount int32) error {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return err
	}
	return reposqlc.SyncNominationPhotoCountsByContest(ctx, &sqlc_repository.SyncNominationPhotoCountsByContestParams{
		ContestID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		MinPhotoCount: minPhotoCount,
		MaxPhotoCount: maxPhotoCount,
	})
}

func (r *Repository) UpdateContestStatus(ctx context.Context, contestID model.ContestID, status model.ContestStatus) (*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return nil, err
	}

	contest, err := reposqlc.UpdateContestStatus(ctx, &sqlc_repository.UpdateContestStatusParams{
		ID:     pgtype.UUID{Bytes: contestUUID, Valid: true},
		Status: string(status),
	})
	if err != nil {
		return nil, err
	}

	return contestFromSQLc(contest), nil
}

func (r *Repository) ListContestsForStatusAutomation(ctx context.Context) ([]*model.Contest, error) {
	reposqlc := sqlc_repository.New(r.conn)
	rows, err := reposqlc.ListContestsForStatusAutomation(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*model.Contest, len(rows))
	for i, c := range rows {
		out[i] = contestFromSQLc(c)
	}
	return out, nil
}

func (r *Repository) DeleteContest(ctx context.Context, contestID model.ContestID) error {
	reposqlc := sqlc_repository.New(r.conn)
	contestUUID, err := uuid.Parse(string(contestID))
	if err != nil {
		return err
	}

	return reposqlc.DeleteContest(ctx, pgtype.UUID{Bytes: contestUUID, Valid: true})
}
