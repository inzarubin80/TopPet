package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"toppet/server/internal/model"
)

func (s *TopPetService) canAccessJuryChair(ctx context.Context, contest *model.Contest, actorID model.UserID) bool {
	if contest == nil || !contest.JuryVotingEnabled {
		return false
	}
	if s.userCanManageContest(ctx, contest, actorID) {
		return true
	}
	m, err := s.repository.GetContestJuryMember(ctx, contest.ID, actorID)
	if err != nil {
		return false
	}
	return m.IsChair
}

func juryChairContestAllowsWrite(c *model.Contest) bool {
	if c == nil {
		return false
	}
	switch c.Status {
	case model.ContestStatusRegistration, model.ContestStatusVoting, model.ContestStatusFinished:
		return true
	default:
		return false
	}
}

// juryChairboardContestAllowsRead — фазы, в которых председатель/организатор могут открыть GET jury-chairboard.
// В draft/publication свод доступен для подготовки (после проверки canAccessJuryChair); те же фазы для остальных
// эндпоинтов чтения баллов по-прежнему закрыты (juryScoresContestAllowsRead).
func juryChairboardContestAllowsRead(c *model.Contest) bool {
	if c == nil {
		return false
	}
	if juryScoresContestAllowsRead(c) {
		return true
	}
	switch c.Status {
	case model.ContestStatusDraft, model.ContestStatusPublication:
		return true
	default:
		return false
	}
}

// GetJuryChairboard — свод баллов по членам жюри и текущие места/призы из снимка (председатель или админ конкурса).
func (s *TopPetService) GetJuryChairboard(ctx context.Context, contestID model.ContestID, actorID model.UserID, nominationFilter *model.ParticipantListNominationFilter) (*model.JuryChairboardData, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !contest.JuryVotingEnabled {
		return nil, model.ErrorForbidden
	}
	if !s.canAccessJuryChair(ctx, contest, actorID) {
		return nil, model.ErrorForbidden
	}
	if !juryChairboardContestAllowsRead(contest) {
		return nil, model.ErrorForbidden
	}

	jurors, err := s.repository.ListContestJuryMembers(ctx, contestID)
	if err != nil {
		return nil, err
	}
	criteria, err := s.repository.ListJuryCriteriaByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	var maxPerJuror float64
	for _, c := range criteria {
		maxPerJuror += float64(c.ScaleMax) * c.Weight
	}
	nj := len(jurors)
	maxTotal := maxPerJuror * float64(nj)

	jurorCols := make([]model.JuryChairJurorColumn, 0, len(jurors))
	for _, j := range jurors {
		jurorCols = append(jurorCols, model.JuryChairJurorColumn{
			UserID:    j.UserID,
			UserName:  j.UserName,
			SortOrder: j.SortOrder,
		})
	}

	viewer := &actorID
	participants, _, err := s.ListParticipantsByContest(ctx, contestID, viewer, nominationFilter, false, model.ParticipantListScopeAll, model.ParticipantListSubmissionAll, false, false, 10000, 0, model.ParticipantListSortCreatedAt)
	if err != nil {
		return nil, err
	}

	cells, err := s.repository.ListJuryWeightedTotalsByContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	byPartJuror := make(map[model.ParticipantID]map[model.UserID]float64)
	for _, cell := range cells {
		if byPartJuror[cell.ParticipantID] == nil {
			byPartJuror[cell.ParticipantID] = make(map[model.UserID]float64)
		}
		byPartJuror[cell.ParticipantID][cell.JurorUserID] = cell.WeightedTotal
	}

	assign := make(map[model.ParticipantID]model.ContestWinnerBrief)
	for _, w := range contest.PersistedJuryWinners {
		assign[w.ParticipantID] = w
	}

	rows := make([]model.JuryChairboardRow, 0, len(participants))
	for _, p := range participants {
		jtot := make(map[string]float64)
		var total float64
		jmap := byPartJuror[p.ID]
		for _, j := range jurors {
			v := 0.0
			if jmap != nil {
				v = jmap[j.UserID]
			}
			jtot[strconv.FormatInt(int64(j.UserID), 10)] = v
			total += v
		}
		coverThumb := ""
		coverFull := ""
		if len(p.Photos) > 0 {
			ph := p.Photos[0]
			coverFull = strings.TrimSpace(ph.URL)
			if ph.ThumbURL != nil && strings.TrimSpace(*ph.ThumbURL) != "" {
				coverThumb = strings.TrimSpace(*ph.ThumbURL)
			} else {
				coverThumb = coverFull
			}
		}
		row := model.JuryChairboardRow{
			ParticipantID: p.ID,
			PetName:       p.PetName,
			EntryTitle:    p.EntryTitle,
			UserName:      p.UserName,
			NominationID:  p.NominationID,
			CoverThumbURL: coverThumb,
			CoverImageURL: coverFull,
			JurorTotals:   jtot,
			TotalScore:    total,
		}
		if w, ok := assign[p.ID]; ok {
			row.Prize = w.Prize
			if w.Place >= 1 {
				pl := w.Place
				row.Place = &pl
			}
		}
		rows = append(rows, row)
	}

	return &model.JuryChairboardData{
		Jurors:              jurorCols,
		Rows:                rows,
		MaxWeightedPerJuror: maxPerJuror,
		MaxTotalWeighted:    maxTotal,
		CriteriaCount:       len(criteria),
		JuryMemberCount:     nj,
	}, nil
}

// PutJuryChairAssignments сохраняет места/призы жюри в jury_winners_snapshot; audience-снимок не трогаем.
func (s *TopPetService) PutJuryChairAssignments(ctx context.Context, contestID model.ContestID, actorID model.UserID, body model.JuryChairAssignmentsPut) (*model.Contest, error) {
	contest, err := s.getContestForBusiness(ctx, contestID)
	if err != nil {
		return nil, err
	}
	if !contest.JuryVotingEnabled {
		return nil, model.ErrorForbidden
	}
	if !juryChairContestAllowsWrite(contest) {
		return nil, fmt.Errorf("%w: jury assignments not allowed in this contest phase", model.ErrBadRequest)
	}
	if !s.canAccessJuryChair(ctx, contest, actorID) {
		return nil, model.ErrorForbidden
	}

	seen := make(map[model.ParticipantID]struct{})
	for _, a := range body.Assignments {
		pid := strings.TrimSpace(string(a.ParticipantID))
		if pid == "" {
			return nil, fmt.Errorf("%w: participant_id required in assignments", model.ErrBadRequest)
		}
		if _, dup := seen[a.ParticipantID]; dup {
			return nil, fmt.Errorf("%w: duplicate participant_id in assignments", model.ErrBadRequest)
		}
		seen[a.ParticipantID] = struct{}{}
		if a.Place != nil && *a.Place < 1 {
			return nil, fmt.Errorf("%w: place must be >= 1 when set", model.ErrBadRequest)
		}
	}

	noms, err := s.repository.ListNominationsByContest(ctx, contestID)
	if err != nil {
		noms = nil
	}
	nomTitle := make(map[string]string)
	for _, n := range noms {
		nomTitle[n.ID] = n.Title
	}

	var winners []model.ContestWinnerBrief
	for _, a := range body.Assignments {
		prize := strings.TrimSpace(a.Prize)
		if a.Place == nil && prize == "" {
			continue
		}
		part, err := s.repository.GetParticipant(ctx, a.ParticipantID)
		if err != nil {
			if errors.Is(err, model.ErrorNotFound) {
				return nil, fmt.Errorf("%w: participant not found", model.ErrBadRequest)
			}
			return nil, err
		}
		if part.ContestID != contestID {
			return nil, fmt.Errorf("%w: participant not in this contest", model.ErrBadRequest)
		}
		sum, err := s.repository.SumJuryScoresByParticipantID(ctx, part.ID)
		if err != nil {
			return nil, err
		}
		score := int64(math.Round(sum))
		var nomCopy *string
		if part.NominationID != nil {
			s := *part.NominationID
			nomCopy = &s
		}
		w := model.ContestWinnerBrief{
			ParticipantID:   part.ID,
			PetName:         part.PetName,
			EntryTitle:      part.EntryTitle,
			NominationID:    nomCopy,
			NominationTitle: nominationTitleFromMap(nomCopy, nomTitle),
			Score:           score,
			Prize:           prize,
		}
		if a.Place != nil {
			w.Place = *a.Place
		}
		winners = append(winners, w)
	}

	sort.Slice(winners, func(i, j int) bool {
		pi, pj := winners[i].Place, winners[j].Place
		if pi == 0 {
			pi = 1 << 30
		}
		if pj == 0 {
			pj = 1 << 30
		}
		if pi != pj {
			return pi < pj
		}
		return winners[i].ParticipantID < winners[j].ParticipantID
	})

	cur, err := s.repository.GetContest(ctx, contestID)
	if err != nil {
		return nil, err
	}
	aud := cur.PersistedAudienceWinners
	if aud == nil {
		aud = []model.ContestWinnerBrief{}
	}
	return s.repository.UpdateContestVotingResults(ctx, contestID, aud, winners)
}

func nominationTitleFromMap(nomID *string, nomTitle map[string]string) string {
	if nomID == nil || *nomID == "" {
		return ""
	}
	return nomTitle[*nomID]
}
