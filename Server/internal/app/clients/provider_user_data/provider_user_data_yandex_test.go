package provideruserdata

import (
	"strings"
	"testing"
	"time"
)

func TestParseYandexProfile_numericIDEmailAvatarPhoneBirthday(t *testing.T) {
	p := &ProviderUserData{provider: "yandex"}
	data, err := p.parseYandexProfile(map[string]interface{}{
		"id":                  float64(1000034426),
		"real_name":           "Test User",
		"default_email":       "a@yandex.ru",
		"default_avatar_id":   "131652443",
		"is_avatar_empty":     false,
		"default_phone":       map[string]interface{}{"number": "+79001234567"},
		"birthday":            "1990-05-15",
	})
	if err != nil {
		t.Fatal(err)
	}
	if data.ProviderID != "1000034426" {
		t.Fatalf("provider id: got %q", data.ProviderID)
	}
	if data.Email != "a@yandex.ru" {
		t.Fatalf("email: got %q", data.Email)
	}
	if !strings.HasPrefix(data.AvatarURL, "https://avatars.yandex.net/get-yapic/131652443/") {
		t.Fatalf("avatar: got %q", data.AvatarURL)
	}
	if data.Phone != "+79001234567" {
		t.Fatalf("phone: got %q", data.Phone)
	}
	if data.DateOfBirth == nil || data.DateOfBirth.Year() != 1990 || data.DateOfBirth.Month() != time.May || data.DateOfBirth.Day() != 15 {
		t.Fatalf("dob: got %v", data.DateOfBirth)
	}
}

func TestParseYandexProfile_emailsFallback(t *testing.T) {
	p := &ProviderUserData{provider: "yandex"}
	data, err := p.parseYandexProfile(map[string]interface{}{
		"id":      "42",
		"emails":  []interface{}{"fallback@yandex.ru"},
		"real_name": "X",
	})
	if err != nil {
		t.Fatal(err)
	}
	if data.Email != "fallback@yandex.ru" {
		t.Fatalf("email: got %q", data.Email)
	}
}

func TestParseYandexProfile_unknownBirthYearSkipped(t *testing.T) {
	p := &ProviderUserData{provider: "yandex"}
	data, err := p.parseYandexProfile(map[string]interface{}{
		"id":       "1",
		"birthday": "0000-12-23",
		"real_name": "X",
	})
	if err != nil {
		t.Fatal(err)
	}
	if data.DateOfBirth != nil {
		t.Fatalf("expected nil dob, got %v", data.DateOfBirth)
	}
}
