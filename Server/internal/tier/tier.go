// Package tier задаёт лимиты тарифов Free vs Pro для организатора.
package tier

const (
	TierFree = "free"
	TierPro  = "pro"
)

const MaxNominationsFree = 3

const MaxJuryCriteriaFree = 5

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
