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

type contestWinnerOutcome struct {
	audienceSet map[model.ParticipantID]struct{}
	jurySet     map[model.ParticipantID]struct{}
	audience    []model.ContestWinnerBrief
	jury        []model.ContestWinnerBrief
}

func nominationBucketKey(nominationID *string) string {
	if nominationID == nil || *nominationID == "" {
		return ""
	}
	return *nominationID
}

// computeContestWinnerOutcome — общая логика: ведра по номинации, максимум голосов/жюри, ничья = все лидеры.
func computeContestWinnerOutcome(contest *model.Contest, rows []model.ParticipantScoreForWinners, nominationTitle func(*string) string) contestWinnerOutcome {
	empty := contestWinnerOutcome{
		audienceSet: make(map[model.ParticipantID]struct{}),
		jurySet:     make(map[model.ParticipantID]struct{}),
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
	sort.Strings(keys)

	out := contestWinnerOutcome{
		audienceSet: make(map[model.ParticipantID]struct{}),
		jurySet:     make(map[model.ParticipantID]struct{}),
	}

	for _, k := range keys {
		g := buckets[k]
		var maxVotes, maxJury int64
		for _, r := range g {
			if r.VoteCount > maxVotes {
				maxVotes = r.VoteCount
			}
			if r.JurySum > maxJury {
				maxJury = r.JurySum
			}
		}
		if contest.PublicVotingEnabled && maxVotes > 0 {
			for _, r := range g {
				if r.VoteCount != maxVotes {
					continue
				}
				out.audienceSet[r.ParticipantID] = struct{}{}
				var nomCopy *string
				if r.NominationID != nil {
					s := *r.NominationID
					nomCopy = &s
				}
				out.audience = append(out.audience, model.ContestWinnerBrief{
					ParticipantID:   r.ParticipantID,
					PetName:           r.PetName,
					NominationID:      nomCopy,
					NominationTitle:   nominationTitle(r.NominationID),
					Score:             r.VoteCount,
				})
			}
		}
		if contest.JuryVotingEnabled && maxJury > 0 {
			for _, r := range g {
				if r.JurySum != maxJury {
					continue
				}
				out.jurySet[r.ParticipantID] = struct{}{}
				var nomCopy *string
				if r.NominationID != nil {
					s := *r.NominationID
					nomCopy = &s
				}
				out.jury = append(out.jury, model.ContestWinnerBrief{
					ParticipantID:   r.ParticipantID,
					PetName:           r.PetName,
					NominationID:      nomCopy,
					NominationTitle:   nominationTitle(r.NominationID),
					Score:             r.JurySum,
				})
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
	o := computeContestWinnerOutcome(contest, rows, nil)
	return contestWinnerSets{audience: o.audienceSet, jury: o.jurySet}
}

func (s *TopPetService) attachParticipantWinnerFlags(ctx context.Context, contest *model.Contest, participants []*model.Participant) {
	if contest == nil || len(participants) == 0 {
		return
	}
	if contest.Status != model.ContestStatusFinished {
		return
	}
	sets := s.computeContestWinnerSets(ctx, contest)
	for _, p := range participants {
		if _, ok := sets.audience[p.ID]; ok {
			p.IsAudienceWinner = true
		}
		if _, ok := sets.jury[p.ID]; ok {
			p.IsJuryWinner = true
		}
	}
}

func (s *TopPetService) attachOneParticipantWinnerFlags(ctx context.Context, contest *model.Contest, participant *model.Participant) {
	if participant == nil {
		return
	}
	s.attachParticipantWinnerFlags(ctx, contest, []*model.Participant{participant})
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
	for _, n := range noms {
		nomMap[n.ID] = n.Title
	}
	o := computeContestWinnerOutcome(contest, rows, func(nid *string) string {
		if nid == nil || *nid == "" {
			return ""
		}
		return nomMap[*nid]
	})
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
	for _, n := range noms {
		if nomByContest[n.ContestID] == nil {
			nomByContest[n.ContestID] = make(map[string]string)
		}
		nomByContest[n.ContestID][n.ID] = n.Title
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
		o := computeContestWinnerOutcome(c, byContest[c.ID], func(nid *string) string {
			if nid == nil || *nid == "" {
				return ""
			}
			return nm[*nid]
		})
		c.AudienceWinners = o.audience
		c.JuryWinners = o.jury
	}
}
