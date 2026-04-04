// Package tier задаёт лимиты тарифов Free vs Pro для организатора.
package tier

const (
	TierFree = "free"
	TierPro  = "pro"
)

const MaxNominationsFree = 3

const MaxJuryCriteriaFree = 5

const MaxJuryMembersFree = 2

func MaxJuryMembersForTier(t string) int {
	if t == TierPro {
		return 50
	}
	return MaxJuryMembersFree
}

func MaxNominationsForTier(t string) int {
	if t == TierPro {
		return 100
	}
	return MaxNominationsFree
}

func MaxJuryCriteriaForTier(t string) int {
	if t == TierPro {
		return 100
	}
	return MaxJuryCriteriaFree
}
