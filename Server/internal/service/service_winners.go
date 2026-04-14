package service

import (
	"context"
	"sort"

	"toppet/server/internal/model"
)

type contestWinnerSets struct {
	audience map[model.ParticipantID]struct{}
	jury     map[model.ParticipantID]struct{}
}

type winnerMeta struct {
	place int
	prize string
}

type contestWinnerOutcome struct {
	audienceSet map[model.ParticipantID]struct{}
	jurySet     map[model.ParticipantID]struct{}
	audienceMeta map[model.ParticipantID]winnerMeta
	juryMeta map[model.ParticipantID]winnerMeta
	audience    []model.ContestWinnerBrief
	jury        []model.ContestWinnerBrief
}

func nominationBucketKey(nominationID *string) string {
	if nominationID == nil || *nominationID == "" {
		return ""
	}
	return *nominationID
}

// sortNominationBucketKeys — порядок ведёр как в настройках номинаций (sort_order; ведро без номинации — в конце).
func sortNominationBucketKeys(keys []string, nominationSortOrder map[string]int) {
	if len(keys) <= 1 {
		return
	}
	if nominationSortOrder == nil {
		sort.Strings(keys)
		return
	}
	const tailEmpty = 1 << 30
	sort.Slice(keys, func(i, j int) bool {
		oi := nominationKeyOrder(keys[i], nominationSortOrder, tailEmpty)
		oj := nominationKeyOrder(keys[j], nominationSortOrder, tailEmpty)
		if oi != oj {
			return oi < oj
		}
		return keys[i] < keys[j]
	})
}

func nominationKeyOrder(k string, m map[string]int, tailEmpty int) int {
	if k == "" {
		return tailEmpty
	}
	if v, ok := m[k]; ok {
		return v
	}
	return tailEmpty - 1
}

// computeTopPlaceWinners — призовые места по «плотному» рангу по уникальным значениям счёта:
// 1-е место — лучший балл, 2-е — следующий уровень (все ничьи на уровне делят место), 3-е — третий уровень и т.д.
// Так «3-е место» не пропадает из-за ничьей на 2-м (в отличие от спортивного ранга 1,2,2,4…).
func computeTopPlaceWinners(
	group []model.ParticipantScoreForWinners,
	places []model.ContestPrizePlace,
	scoreOf func(model.ParticipantScoreForWinners) int64,
) []model.ContestWinnerBrief {
	if len(group) == 0 || len(places) == 0 {
		return nil
	}
	sorted := make([]model.ParticipantScoreForWinners, len(group))
	copy(sorted, group)
	sort.Slice(sorted, func(i, j int) bool {
		si := scoreOf(sorted[i])
		sj := scoreOf(sorted[j])
		if si != sj {
			return si > sj
		}
		return sorted[i].ParticipantID < sorted[j].ParticipantID
	})
	byPlace := make(map[int]model.ContestPrizePlace, len(places))
	for _, p := range places {
		if p.Place < 1 {
			continue
		}
		byPlace[p.Place] = p
	}
	var out []model.ContestWinnerBrief
	rank := 0
	lastScore := int64(-1)
	for _, row := range sorted {
		score := scoreOf(row)
		if score <= 0 {
			break
		}
		if score != lastScore {
			rank++
			lastScore = score
		}
		placeCfg, ok := byPlace[rank]
		if !ok {
			continue
		}
		var nomCopy *string
		if row.NominationID != nil {
			s := *row.NominationID
			nomCopy = &s
		}
		out = append(out, model.ContestWinnerBrief{
			ParticipantID: row.ParticipantID,
			PetName: row.PetName,
			NominationID: nomCopy,
			Score: score,
			Place: placeCfg.Place,
			Prize: placeCfg.Prize,
		})
	}
	return out
}

// computeContestWinnerOutcome — ведра по номинации; места по плотному рангу счёта (ничьи делят ступень).
func computeContestWinnerOutcome(contest *model.Contest, rows []model.ParticipantScoreForWinners, nominationTitle func(*string) string, nominationSortOrder map[string]int) contestWinnerOutcome {
	empty := contestWinnerOutcome{
		audienceSet: make(map[model.ParticipantID]struct{}),
		jurySet:     make(map[model.ParticipantID]struct{}),
		audienceMeta: make(map[model.ParticipantID]winnerMeta),
		juryMeta: make(map[model.ParticipantID]winnerMeta),
	}
	if nominationTitle == nil {
		nominationTitle = func(*string) string { return "" }
	}
	if contest == nil || contest.Status != model.ContestStatusFinished || len(rows) == 0 {
		return empty
	}

	buckets := make(map[string][]model.ParticipantScoreForWinners)
	for _, row := range rows {
		k := nominationBucketKey(row.NominationID)
		buckets[k] = append(buckets[k], row)
	}
	keys := make([]string, 0, len(buckets))
	for k := range buckets {
		keys = append(keys, k)
	}
	sortNominationBucketKeys(keys, nominationSortOrder)

	out := contestWinnerOutcome{
		audienceSet: make(map[model.ParticipantID]struct{}),
		jurySet:     make(map[model.ParticipantID]struct{}),
		audienceMeta: make(map[model.ParticipantID]winnerMeta),
		juryMeta: make(map[model.ParticipantID]winnerMeta),
	}

	for _, k := range keys {
		g := buckets[k]
		if contest.PublicVotingEnabled {
			audienceWinners := computeTopPlaceWinners(g, contest.AudiencePrizePlaces, func(r model.ParticipantScoreForWinners) int64 {
				return r.VoteCount
			})
			for _, w := range audienceWinners {
				w.NominationTitle = nominationTitle(w.NominationID)
				out.audienceSet[w.ParticipantID] = struct{}{}
				out.audienceMeta[w.ParticipantID] = winnerMeta{place: w.Place, prize: w.Prize}
				out.audience = append(out.audience, w)
			}
		}
		if contest.JuryVotingEnabled {
			juryWinners := computeTopPlaceWinners(g, contest.JuryPrizePlaces, func(r model.ParticipantScoreForWinners) int64 {
				return r.JurySum
			})
			for _, w := range juryWinners {
				w.NominationTitle = nominationTitle(w.NominationID)
				out.jurySet[w.ParticipantID] = struct{}{}
				out.juryMeta[w.ParticipantID] = winnerMeta{place: w.Place, prize: w.Prize}
				out.jury = append(out.jury, w)
			}
		}
	}
	return out
}

func (s *TopPetService) computeContestWinnerSets(ctx context.Context, contest *model.Contest) contestWinnerSets {
	empty := contestWinnerSets{
		audience: make(map[model.ParticipantID]struct{}),
		jury:     make(map[model.ParticipantID]struct{}),
	}
	if contest == nil || contest.Status != model.ContestStatusFinished {
		return empty
	}
	rows, err := s.repository.ListAcceptedParticipantScoresForContest(ctx, contest.ID)
	if err != nil || len(rows) == 0 {
		return empty
	}
	o := computeContestWinnerOutcome(contest, rows, nil, nil)
	return contestWinnerSets{audience: o.audienceSet, jury: o.jurySet}
}

func (s *TopPetService) attachParticipantWinnerFlags(ctx context.Context, contest *model.Contest, participants []*model.Participant) {
	if contest == nil || len(participants) == 0 {
		return
	}
	if contest.Status != model.ContestStatusFinished {
		return
	}
	rows, err := s.repository.ListAcceptedParticipantScoresForContest(ctx, contest.ID)
	if err != nil || len(rows) == 0 {
		return
	}
	o := computeContestWinnerOutcome(contest, rows, nil, nil)
	for _, p := range participants {
		if _, ok := o.audienceSet[p.ID]; ok {
			p.IsAudienceWinner = true
			if meta, has := o.audienceMeta[p.ID]; has {
				p.AudienceWinnerPlace = &meta.place
				p.AudienceWinnerPrize = meta.prize
			}
		}
		if _, ok := o.jurySet[p.ID]; ok {
			p.IsJuryWinner = true
			if meta, has := o.juryMeta[p.ID]; has {
				p.JuryWinnerPlace = &meta.place
				p.JuryWinnerPrize = meta.prize
			}
		}
	}
}

func (s *TopPetService) attachOneParticipantWinnerFlags(ctx context.Context, contest *model.Contest, participant *model.Participant) {
	if participant == nil {
		return
	}
	if contest == nil || contest.Status != model.ContestStatusFinished {
		return
	}
	rows, err := s.repository.ListAcceptedParticipantScoresForContest(ctx, contest.ID)
	if err != nil || len(rows) == 0 {
		return
	}
	o := computeContestWinnerOutcome(contest, rows, nil, nil)
	if _, ok := o.audienceSet[participant.ID]; ok {
		participant.IsAudienceWinner = true
		if meta, has := o.audienceMeta[participant.ID]; has {
			participant.AudienceWinnerPlace = &meta.place
			participant.AudienceWinnerPrize = meta.prize
		}
	}
	if _, ok := o.jurySet[participant.ID]; ok {
		participant.IsJuryWinner = true
		if meta, has := o.juryMeta[participant.ID]; has {
			participant.JuryWinnerPlace = &meta.place
			participant.JuryWinnerPrize = meta.prize
		}
	}
}

func (s *TopPetService) enrichContestWithWinners(ctx context.Context, contest *model.Contest) {
	if contest == nil || contest.Status != model.ContestStatusFinished {
		return
	}
	rows, err := s.repository.ListAcceptedParticipantScoresForContest(ctx, contest.ID)
	if err != nil || len(rows) == 0 {
		return
	}
	noms, err := s.repository.ListNominationsByContest(ctx, contest.ID)
	if err != nil {
		noms = nil
	}
	nomMap := make(map[string]string)
	nomSortOrder := make(map[string]int)
	for _, n := range noms {
		nomMap[n.ID] = n.Title
		nomSortOrder[n.ID] = n.SortOrder
	}
	o := computeContestWinnerOutcome(contest, rows, func(nid *string) string {
		if nid == nil || *nid == "" {
			return ""
		}
		return nomMap[*nid]
	}, nomSortOrder)
	contest.AudienceWinners = o.audience
	contest.JuryWinners = o.jury
}

func (s *TopPetService) enrichContestsWithWinners(ctx context.Context, contests []*model.Contest) {
	if len(contests) == 0 {
		return
	}
	var finishedIDs []model.ContestID
	for _, c := range contests {
		if c != nil && c.Status == model.ContestStatusFinished {
			finishedIDs = append(finishedIDs, c.ID)
		}
	}
	if len(finishedIDs) == 0 {
		return
	}
	rows, err := s.repository.ListAcceptedParticipantScoresForContests(ctx, finishedIDs)
	if err != nil || len(rows) == 0 {
		return
	}
	noms, err := s.repository.ListNominationsForContests(ctx, finishedIDs)
	if err != nil {
		noms = nil
	}
	nomByContest := make(map[model.ContestID]map[string]string)
	nomSortByContest := make(map[model.ContestID]map[string]int)
	for _, n := range noms {
		if nomByContest[n.ContestID] == nil {
			nomByContest[n.ContestID] = make(map[string]string)
		}
		nomByContest[n.ContestID][n.ID] = n.Title
		if nomSortByContest[n.ContestID] == nil {
			nomSortByContest[n.ContestID] = make(map[string]int)
		}
		nomSortByContest[n.ContestID][n.ID] = n.SortOrder
	}
	byContest := make(map[model.ContestID][]model.ParticipantScoreForWinners)
	for _, r := range rows {
		if r.ContestID == "" {
			continue
		}
		byContest[r.ContestID] = append(byContest[r.ContestID], r)
	}
	for _, c := range contests {
		if c == nil || c.Status != model.ContestStatusFinished {
			continue
		}
		nm := nomByContest[c.ID]
		if nm == nil {
			nm = map[string]string{}
		}
		ns := nomSortByContest[c.ID]
		if ns == nil {
			ns = map[string]int{}
		}
		o := computeContestWinnerOutcome(c, byContest[c.ID], func(nid *string) string {
			if nid == nil || *nid == "" {
				return ""
			}
			return nm[*nid]
		}, ns)
		c.AudienceWinners = o.audience
		c.JuryWinners = o.jury
	}
}
