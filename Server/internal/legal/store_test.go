package legal

import "testing"

func TestLoad(t *testing.T) {
	s, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	list := s.List()
	if len(list) < 2 {
		t.Fatalf("want at least 2 documents, got %d", len(list))
	}
	p, err := s.Get(IDPrivacy)
	if err != nil {
		t.Fatal(err)
	}
	if p.Version == "" || p.Content == "" {
		t.Fatalf("privacy document empty")
	}
	v, err := s.Version(IDTerms)
	if err != nil || v == "" {
		t.Fatalf("terms version: %v %q", err, v)
	}
}
