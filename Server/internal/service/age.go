package service

import (
	"time"
)

// userAtLeastAgeYears проверяет, что на дату ref пользователю исполнилось не менее years лет
// (сравнение календарных дат в зоне loc).
func userAtLeastAgeYears(dob time.Time, years int, ref time.Time, loc *time.Location) bool {
	if loc == nil {
		loc = time.UTC
	}
	r := ref.In(loc)
	cutoff := time.Date(r.Year(), r.Month(), r.Day(), 0, 0, 0, 0, loc).AddDate(-years, 0, 0)
	b := dob.In(loc)
	bday := time.Date(b.Year(), b.Month(), b.Day(), 0, 0, 0, 0, loc)
	return !bday.After(cutoff)
}
