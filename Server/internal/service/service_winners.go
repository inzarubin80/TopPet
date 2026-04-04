package service

import (
	"context"

	"toppet/server/internal/model"
)

type contestWinnerSets struct {
	audience map[model.ParticipantID]struct{}
	jury     map[model.ParticipantID]struct{}
}

func nominationBucketKey(nominationID *string) string {
	if nominationID == nil || *nominationID == "" {
		return ""
	}
	return *nominationID
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
	buckets := make(map[string][]model.ParticipantScoreForWinners)
	for _, row := range rows {
		k := nominationBucketKey(row.NominationID)
		buckets[k] = append(buckets[k], row)
	}
	for _, g := range buckets {
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
				if r.VoteCount == maxVotes {
					empty.audience[r.ParticipantID] = struct{}{}
				}
			}
		}
		if contest.JuryVotingEnabled && maxJury > 0 {
			for _, r := range g {
				if r.JurySum == maxJury {
					empty.jury[r.ParticipantID] = struct{}{}
				}
			}
		}
	}
	return empty
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
