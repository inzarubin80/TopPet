package service

import (
	"testing"
	"time"
)

func TestUserAtLeastAgeYears(t *testing.T) {
	loc, err := time.LoadLocation("Europe/Moscow")
	if err != nil {
		t.Fatal(err)
	}
	ref := time.Date(2026, 3, 20, 12, 0, 0, 0, loc)
	dob18 := time.Date(2008, 3, 20, 0, 0, 0, 0, time.UTC)
	if !userAtLeastAgeYears(dob18, 18, ref, loc) {
		t.Fatalf("expected 18 on birthday")
	}
	dob17 := time.Date(2008, 3, 21, 0, 0, 0, 0, time.UTC)
	if userAtLeastAgeYears(dob17, 18, ref, loc) {
		t.Fatalf("expected under 18 day before birthday")
	}
}
