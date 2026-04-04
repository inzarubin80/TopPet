package model

import (
	"fmt"
	"regexp"
	"strings"
)

const (
	maxParticipantEmailDomains    = 32
	maxParticipantEmailDomainsLen = 4096
)

// Допустимый формат одного домена (FQDN, без @).
var participantEmailDomainPattern = regexp.MustCompile(`(?i)^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$`)

// ParseParticipantEmailDomainsDB разбирает значение из БД (переносы строки, запятые, точки с запятой).
func ParseParticipantEmailDomainsDB(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == '\n' || r == ',' || r == ';'
	})
	out := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, p := range parts {
		d := strings.ToLower(strings.TrimSpace(p))
		if d == "" {
			continue
		}
		if _, ok := seen[d]; ok {
			continue
		}
		seen[d] = struct{}{}
		out = append(out, d)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// JoinParticipantEmailDomainsDB сериализует список для колонки БД.
func JoinParticipantEmailDomainsDB(domains []string) string {
	if len(domains) == 0 {
		return ""
	}
	return strings.Join(domains, "\n")
}

// ValidateAndNormalizeEmailDomains проверяет и нормализует список из API (PATCH).
func ValidateAndNormalizeEmailDomains(in []string) ([]string, error) {
	if len(in) > maxParticipantEmailDomains {
		return nil, fmt.Errorf("too many email domains (max %d)", maxParticipantEmailDomains)
	}
	out := make([]string, 0, len(in))
	seen := make(map[string]struct{})
	for _, raw := range in {
		d := strings.ToLower(strings.TrimSpace(raw))
		if d == "" {
			continue
		}
		if !participantEmailDomainPattern.MatchString(d) {
			return nil, fmt.Errorf("invalid email domain: %q", raw)
		}
		if len(d) > 253 {
			return nil, fmt.Errorf("email domain too long: %q", raw)
		}
		if _, ok := seen[d]; ok {
			continue
		}
		seen[d] = struct{}{}
		out = append(out, d)
	}
	joined := JoinParticipantEmailDomainsDB(out)
	if len(joined) > maxParticipantEmailDomainsLen {
		return nil, fmt.Errorf("email domains list is too long")
	}
	return out, nil
}

// ValidateParticipantEmailDomainsDBString ограничение длины уже сохранённого значения.
func ValidateParticipantEmailDomainsDBString(raw string) error {
	if len(raw) > maxParticipantEmailDomainsLen {
		return fmt.Errorf("email domains list is too long")
	}
	return nil
}

// EmailDomainMatchesAllowlist true, если host части e-mail совпадает с доменом или его поддоменом.
func EmailDomainMatchesAllowlist(email string, allowed []string) bool {
	if len(allowed) == 0 {
		return true
	}
	email = strings.TrimSpace(strings.ToLower(email))
	at := strings.LastIndexByte(email, '@')
	if at < 0 || at == len(email)-1 {
		return false
	}
	host := email[at+1:]
	for _, d := range allowed {
		if host == d || strings.HasSuffix(host, "."+d) {
			return true
		}
	}
	return false
}
