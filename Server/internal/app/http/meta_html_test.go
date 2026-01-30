package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
	"unicode/utf8"

	"toppet/server/internal/model"
)

type mockMetaHTMLService struct {
	contest     *model.Contest
	participants []*model.Participant
	participant *model.Participant
}

func (m *mockMetaHTMLService) GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	if m.contest != nil && m.contest.ID == contestID {
		return m.contest, nil
	}
	return nil, nil
}

func (m *mockMetaHTMLService) ListParticipantsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Participant, error) {
	return m.participants, nil
}

func (m *mockMetaHTMLService) GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error) {
	if m.participant != nil && m.participant.ID == participantID {
		return m.participant, nil
	}
	return nil, nil
}

func TestMetaHTML_ServeHome_HTMLAndMeta(t *testing.T) {
	dir := t.TempDir()
	indexPath := dir + "/index.html"
	if err := writeMinimalIndex(indexPath); err != nil {
		t.Fatalf("write index: %v", err)
	}
	svc := &mockMetaHTMLService{}
	h := NewMetaHTMLHandler("https://top-pet.ru", indexPath, svc)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHome(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	html := rec.Body.String()

	checkMetaPresent(t, html, "home", map[string]bool{
		"og:title":       true,
		"og:description": true,
		"og:url":         true,
		"og:image":       true,
		"og:type":        true,
		"og:site_name":   true,
		"og:locale":      true,
		"og:image:alt":   true,
		"twitter:card":   true,
		"twitter:title":  true,
		"twitter:description": true,
		"twitter:image": true,
	})
	if !strings.Contains(html, `rel="canonical"`) {
		t.Error("home HTML: missing rel=canonical")
	}
	if !strings.Contains(html, `href="https://top-pet.ru/"`) {
		t.Error("home HTML: canonical href should be base URL /")
	}
	if !strings.Contains(html, `id="og-preview"`) {
		t.Error("home HTML: missing #og-preview")
	}
}

func TestMetaHTML_ServeContest_HTMLAndMeta(t *testing.T) {
	dir := t.TempDir()
	indexPath := dir + "/index.html"
	if err := writeMinimalIndex(indexPath); err != nil {
		t.Fatalf("write index: %v", err)
	}

	contest := &model.Contest{
		ID:          "contest-1",
		Title:       "Конкурс красоты котиков",
		Description: "Описание конкурса для теста.",
	}
	participants := []*model.Participant{
		{
			ID:      "part-1",
			PetName: "Мурзик",
			Photos:  []*model.Photo{{URL: "https://example.com/photo.jpg", Position: 0}},
		},
	}
	svc := &mockMetaHTMLService{contest: contest, participants: participants}
	h := NewMetaHTMLHandler("https://top-pet.ru", indexPath, svc)

	req := httptest.NewRequest(http.MethodGet, "/contests/contest-1", nil)
	req.SetPathValue("contestId", "contest-1")
	rec := httptest.NewRecorder()
	h.ServeContest(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	html := rec.Body.String()

	// SEO: required OG and Twitter meta (including og:locale, og:image:alt per task 1.2)
	checkMetaPresent(t, html, "contest", map[string]bool{
		"og:title":       true,
		"og:description": true,
		"og:url":         true,
		"og:image":       true,
		"og:type":        true,
		"og:site_name":   true,
		"og:locale":      true,
		"og:image:alt":   true,
		"twitter:card":   true,
		"twitter:title":  true,
		"twitter:description": true,
		"twitter:image": true,
		"twitter:image:alt": true,
	})

	// Contest: title and description must be within limits (task 1.1)
	ogTitle := extractMetaContent(html, `property="og:title"`)
	if ogTitle == "" {
		t.Error("og:title content empty")
	}
	if n := utf8.RuneCountInString(ogTitle); n > 60 {
		t.Errorf("contest og:title length %d > 60", n)
	}
	ogDesc := extractMetaContent(html, `property="og:description"`)
	if n := utf8.RuneCountInString(ogDesc); n > 160 {
		t.Errorf("contest og:description length %d > 160", n)
	}

	// Design: #og-preview card with h1 and p (task 1.3)
	if !strings.Contains(html, `id="og-preview"`) {
		t.Error("contest HTML: missing #og-preview")
	}
	if !strings.Contains(html, `<img `) {
		t.Error("contest HTML: missing img in preview")
	}
	if !strings.Contains(html, `<h1 `) {
		t.Error("contest HTML: missing h1 in preview card")
	}
	if !strings.Contains(html, `<p style=`) {
		t.Error("contest HTML: missing p in preview card")
	}

	// Task 3.1: canonical URL
	if !strings.Contains(html, `rel="canonical"`) {
		t.Error("contest HTML: missing rel=canonical")
	}
	if !strings.Contains(html, `href="https://top-pet.ru/contests/contest-1"`) {
		t.Error("contest HTML: canonical href should match contest URL")
	}
}

func TestMetaHTML_ServeContest_DefaultImageNotSVG(t *testing.T) {
	dir := t.TempDir()
	indexPath := dir + "/index.html"
	if err := writeMinimalIndex(indexPath); err != nil {
		t.Fatalf("write index: %v", err)
	}
	contest := &model.Contest{ID: "c1", Title: "T", Description: "D"}
	svc := &mockMetaHTMLService{contest: contest, participants: nil}
	h := NewMetaHTMLHandler("https://top-pet.ru", indexPath, svc)
	req := httptest.NewRequest(http.MethodGet, "/contests/c1", nil)
	req.SetPathValue("contestId", "c1")
	rec := httptest.NewRecorder()
	h.ServeContest(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	html := rec.Body.String()
	ogImage := extractMetaContent(html, `property="og:image"`)
	if strings.HasSuffix(ogImage, ".svg") {
		t.Errorf("contest default og:image should not be SVG, got %q", ogImage)
	}
	// Task 2.2: default image should have width/height and secure_url when baseURL is https
	if !strings.Contains(html, `property="og:image:width"`) {
		t.Error("contest default image: missing og:image:width")
	}
	if !strings.Contains(html, `property="og:image:height"`) {
		t.Error("contest default image: missing og:image:height")
	}
	if !strings.Contains(html, `property="og:image:secure_url"`) {
		t.Error("contest default image with https baseURL: missing og:image:secure_url")
	}
}

func TestMetaHTML_ServeContest_Truncation(t *testing.T) {
	dir := t.TempDir()
	indexPath := dir + "/index.html"
	if err := writeMinimalIndex(indexPath); err != nil {
		t.Fatalf("write index: %v", err)
	}
	longTitle := strings.Repeat("а", 80)
	longDesc := strings.Repeat("б", 200)
	contest := &model.Contest{
		ID:          "c1",
		Title:       longTitle,
		Description: longDesc,
	}
	svc := &mockMetaHTMLService{contest: contest, participants: nil}
	h := NewMetaHTMLHandler("https://top-pet.ru", indexPath, svc)
	req := httptest.NewRequest(http.MethodGet, "/contests/c1", nil)
	req.SetPathValue("contestId", "c1")
	rec := httptest.NewRecorder()
	h.ServeContest(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	html := rec.Body.String()
	ogTitle := extractMetaContent(html, `property="og:title"`)
	if n := utf8.RuneCountInString(ogTitle); n > 60 {
		t.Errorf("contest long title: og:title length %d > 60", n)
	}
	ogDesc := extractMetaContent(html, `property="og:description"`)
	if n := utf8.RuneCountInString(ogDesc); n > 160 {
		t.Errorf("contest long description: og:description length %d > 160", n)
	}
}

func TestMetaHTML_ServeParticipant_HTMLAndMeta(t *testing.T) {
	dir := t.TempDir()
	indexPath := dir + "/index.html"
	if err := writeMinimalIndex(indexPath); err != nil {
		t.Fatalf("write index: %v", err)
	}

	contest := &model.Contest{ID: "contest-1", Title: "Конкурс котиков"}
	participant := &model.Participant{
		ID:             "part-1",
		ContestID:      "contest-1",
		PetName:        "Мурзик",
		PetDescription: "Ласковый кот.",
		Photos:         []*model.Photo{{URL: "https://example.com/photo.jpg", Position: 0}},
	}
	svc := &mockMetaHTMLService{
		contest:     contest,
		participant: participant,
	}
	h := NewMetaHTMLHandler("https://top-pet.ru", indexPath, svc)

	req := httptest.NewRequest(http.MethodGet, "/contests/contest-1/participants/part-1", nil)
	req.SetPathValue("contestId", "contest-1")
	req.SetPathValue("participantId", "part-1")
	rec := httptest.NewRecorder()
	h.ServeParticipant(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	html := rec.Body.String()

	// SEO: required OG and Twitter meta
	checkMetaPresent(t, html, "participant", map[string]bool{
		"og:title":       true,
		"og:description": true,
		"og:url":         true,
		"og:image":       true,
		"og:type":        true,
		"og:site_name":   true,
		"og:locale":      true,
		"og:image:alt":   true,
		"twitter:card":   true,
		"twitter:title":  true,
		"twitter:description": true,
		"twitter:image": true,
		"twitter:image:alt": true,
	})

	// Participant: title ≤50, description ≤160, CTA suffix visible (plan)
	ogTitle := extractMetaContent(html, `property="og:title"`)
	if n := utf8.RuneCountInString(ogTitle); n > 50 {
		t.Errorf("participant og:title length %d > 50", n)
	}
	ogDesc := extractMetaContent(html, `property="og:description"`)
	if n := utf8.RuneCountInString(ogDesc); n > 160 {
		t.Errorf("participant og:description length %d > 160", n)
	}
	const ctaSuffix = " Голосуйте на Top-Pet!"
	if !strings.HasSuffix(ogDesc, ctaSuffix) {
		t.Errorf("participant og:description must end with CTA %q, got %q", ctaSuffix, ogDesc)
	}

	// Design: #og-preview card with h1 and p
	if !strings.Contains(html, `id="og-preview"`) {
		t.Error("participant HTML: missing #og-preview")
	}
	if !strings.Contains(html, `<h1 `) {
		t.Error("participant HTML: missing h1 in card")
	}
	if !strings.Contains(html, `<p style=`) {
		t.Error("participant HTML: missing p in card")
	}
	if !strings.Contains(html, `<img `) {
		t.Error("participant HTML: missing img in card")
	}

	// Task 3.1: canonical URL
	if !strings.Contains(html, `rel="canonical"`) {
		t.Error("participant HTML: missing rel=canonical")
	}
	if !strings.Contains(html, `href="https://top-pet.ru/contests/contest-1/participants/part-1"`) {
		t.Error("participant HTML: canonical href should match participant URL")
	}
}

func writeMinimalIndex(path string) error {
	content := `<!DOCTYPE html><html><head><title>Top-Pet</title></head><body><div id="root"></div></body></html>`
	return os.WriteFile(path, []byte(content), 0644)
}

func checkMetaPresent(t *testing.T, html, page string, required map[string]bool) {
	t.Helper()
	for name, must := range required {
		if !must {
			continue
		}
		var needle string
		if strings.HasPrefix(name, "og:") {
			needle = `property="` + name + `"`
		} else {
			needle = `name="` + name + `"`
		}
		if !strings.Contains(html, needle) {
			t.Errorf("%s: missing meta %s", page, name)
		}
	}
}

func extractMetaContent(html, attr string) string {
	// Find content="..." after the meta tag that contains attr (e.g. property="og:title")
	re := regexp.MustCompile(`<meta[^>]*` + regexp.QuoteMeta(attr) + `[^>]*content="([^"]*)"`)
	m := re.FindStringSubmatch(html)
	if len(m) < 2 {
		// Try content before attr
		re2 := regexp.MustCompile(`content="([^"]*)"[^>]*` + regexp.QuoteMeta(attr))
		m = re2.FindStringSubmatch(html)
	}
	if len(m) >= 2 {
		return m[1]
	}
	return ""
}
