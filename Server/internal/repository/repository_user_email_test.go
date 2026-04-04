package repository

import "testing"

func TestNormalizeOAuthEmail(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in, want string
	}{
		{"", ""},
		{"  ", ""},
		{"not-an-email", ""},
		{"a@b.co", "a@b.co"},
		{"  user@example.com  ", "user@example.com"},
	}
	for _, c := range cases {
		if got := normalizeOAuthEmail(c.in); got != c.want {
			t.Errorf("normalizeOAuthEmail(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
