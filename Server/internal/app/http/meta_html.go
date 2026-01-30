package http

import (
	"context"
	"html"
	"net/http"
	"os"
	"sort"
	"strings"
	"unicode/utf8"

	"toppet/server/internal/model"
)

type (
	serviceMetaHTML interface {
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		ListParticipantsByContest(ctx context.Context, contestID model.ContestID) ([]*model.Participant, error)
		GetParticipant(ctx context.Context, participantID model.ParticipantID) (*model.Participant, error)
	}

	metaHTMLHandler struct {
		baseURL     string
		spaIndexPath string
		service     serviceMetaHTML
	}
)

func NewMetaHTMLHandler(baseURL, spaIndexPath string, service serviceMetaHTML) *metaHTMLHandler {
	baseURL = strings.TrimSuffix(baseURL, "/")
	return &metaHTMLHandler{baseURL: baseURL, spaIndexPath: spaIndexPath, service: service}
}

func (h *metaHTMLHandler) canServe() bool {
	return h.spaIndexPath != ""
}

func (h *metaHTMLHandler) readIndexHTML() ([]byte, error) {
	return os.ReadFile(h.spaIndexPath)
}

// truncateRunes truncates s to at most max runes, appending "…" if truncated.
func truncateRunes(s string, max int) string {
	if max <= 0 {
		return ""
	}
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max-1]) + "…"
}

func firstParticipantPhotoURL(participants []*model.Participant) string {
	for _, p := range participants {
		if len(p.Photos) == 0 {
			continue
		}
		photos := make([]*model.Photo, len(p.Photos))
		copy(photos, p.Photos)
		sort.Slice(photos, func(i, j int) bool { return photos[i].Position < photos[j].Position })
		if photos[0].URL != "" {
			return photos[0].URL
		}
	}
	return ""
}

func firstPhotoURLFromParticipant(p *model.Participant) string {
	if p == nil || len(p.Photos) == 0 {
		return ""
	}
	photos := make([]*model.Photo, len(p.Photos))
	copy(photos, p.Photos)
	sort.Slice(photos, func(i, j int) bool { return photos[i].Position < photos[j].Position })
	return photos[0].URL
}

func (h *metaHTMLHandler) defaultImageURL() string {
	return h.baseURL + "/icon.svg"
}

const (
	ogTitleMaxRunes    = 60
	ogDescriptionMaxRunes = 160
	participantCTASuffix  = " Голосуйте на Top-Pet!"
)

func (h *metaHTMLHandler) buildMetaTags(title, description, url, imageURL, imageAlt, locale string) string {
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	}
	title = html.EscapeString(title)
	description = html.EscapeString(description)
	url = html.EscapeString(url)
	imageURL = html.EscapeString(imageURL)
	imageAlt = html.EscapeString(imageAlt)
	const siteName = "Top-Pet"
	var b strings.Builder
	b.WriteString(`<meta name="description" content="`)
	b.WriteString(description)
	b.WriteString(`">`)
	b.WriteString(`<meta property="og:title" content="`)
	b.WriteString(title)
	b.WriteString(`">`)
	b.WriteString(`<meta property="og:description" content="`)
	b.WriteString(description)
	b.WriteString(`">`)
	b.WriteString(`<meta property="og:url" content="`)
	b.WriteString(url)
	b.WriteString(`">`)
	b.WriteString(`<meta property="og:type" content="website">`)
	b.WriteString(`<meta property="og:image" content="`)
	b.WriteString(imageURL)
	b.WriteString(`">`)
	if locale != "" {
		b.WriteString(`<meta property="og:locale" content="`)
		b.WriteString(locale)
		b.WriteString(`">`)
	}
	if imageAlt != "" {
		b.WriteString(`<meta property="og:image:alt" content="`)
		b.WriteString(imageAlt)
		b.WriteString(`">`)
	}
	b.WriteString(`<meta property="og:site_name" content="`)
	b.WriteString(html.EscapeString(siteName))
	b.WriteString(`">`)
	b.WriteString(`<meta name="twitter:card" content="summary_large_image">`)
	b.WriteString(`<meta name="twitter:title" content="`)
	b.WriteString(title)
	b.WriteString(`">`)
	b.WriteString(`<meta name="twitter:description" content="`)
	b.WriteString(description)
	b.WriteString(`">`)
	b.WriteString(`<meta name="twitter:image" content="`)
	b.WriteString(imageURL)
	b.WriteString(`">`)
	if imageAlt != "" {
		b.WriteString(`<meta name="twitter:image:alt" content="`)
		b.WriteString(imageAlt)
		b.WriteString(`">`)
	}
	return b.String()
}

func (h *metaHTMLHandler) injectMetaIntoHTML(htmlBytes []byte, pageTitle, metaTags string) []byte {
	oldTitle := []byte("<title>Top-Pet</title>")
	newHead := []byte("<title>" + html.EscapeString(pageTitle) + "</title>\n    " + metaTags)
	return []byte(strings.Replace(string(htmlBytes), string(oldTitle), string(newHead), 1))
}

// participantTitleForOG returns "Кличка — Название конкурса" truncated to ogTitleMaxRunes, or "Кличка — Top-Pet" if contestTitle is empty.
func participantTitleForOG(petName, contestTitle string) string {
	if contestTitle == "" {
		return truncateRunes(petName+" — Top-Pet", ogTitleMaxRunes)
	}
	full := petName + " — " + contestTitle
	return truncateRunes(full, ogTitleMaxRunes)
}

// participantDescription builds og:description: one line from petDesc + CTA, max 160 runes. If petDesc empty, "Голосуйте за [petName] на Top-Pet!".
func participantDescription(petName, petDesc string) string {
	cta := participantCTASuffix
	if petDesc == "" {
		return truncateRunes("Голосуйте за "+petName+" на Top-Pet!", ogDescriptionMaxRunes)
	}
	oneLine := strings.TrimSpace(strings.ReplaceAll(petDesc, "\n", " "))
	oneLine = strings.Join(strings.Fields(oneLine), " ")
	maxDesc := ogDescriptionMaxRunes - utf8.RuneCountInString(cta)
	if utf8.RuneCountInString(oneLine) > maxDesc {
		oneLine = truncateRunes(oneLine, maxDesc)
	}
	return oneLine + cta
}

// injectPreviewImage inserts a visible preview image in the body (after <body>), for crawlers and direct opens.
func (h *metaHTMLHandler) injectPreviewImage(htmlBytes []byte, imageURL, title string) []byte {
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	}
	imageURL = html.EscapeString(imageURL)
	title = html.EscapeString(title)
	block := `<div id="og-preview" style="text-align:center;max-width:100%;margin:0 auto;padding:16px;background:#f5f5f5;"><img src="` + imageURL + `" alt="` + title + `" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;" /></div>`
	oldBody := "<body>"
	newBody := "<body>\n  " + block
	return []byte(strings.Replace(string(htmlBytes), oldBody, newBody, 1))
}

// injectParticipantPreviewCard inserts a card (image + title + description) after <body> for participant pages.
func (h *metaHTMLHandler) injectParticipantPreviewCard(htmlBytes []byte, imageURL, title, description string) []byte {
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	}
	imageURL = html.EscapeString(imageURL)
	title = html.EscapeString(title)
	description = html.EscapeString(description)
	block := `<div id="og-preview" style="text-align:center;max-width:600px;margin:0 auto;padding:24px;background:#f8f9fa;font-family:system-ui,-apple-system,sans-serif;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><img src="` + imageURL + `" alt="` + title + `" style="max-width:100%;height:auto;display:block;margin:0 auto 16px;border-radius:8px;" /><h1 style="margin:0 0 12px;font-size:1.5rem;font-weight:600;color:#1a1a1a;">` + title + `</h1><p style="margin:0;font-size:1rem;line-height:1.5;color:#444;">` + description + `</p></div>`
	oldBody := "<body>"
	newBody := "<body>\n  " + block
	return []byte(strings.Replace(string(htmlBytes), oldBody, newBody, 1))
}

func (h *metaHTMLHandler) ServeContest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || !h.canServe() {
		http.NotFound(w, r)
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	if contestID == "" {
		http.NotFound(w, r)
		return
	}

	contest, err := h.service.GetContest(r.Context(), contestID)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	participants, _ := h.service.ListParticipantsByContest(r.Context(), contestID)
	imageURL := firstParticipantPhotoURL(participants)
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	}

	pageTitle := contest.Title + " - Top-Pet"
	description := contest.Description
	if description == "" {
		description = contest.Title
	}
	description = description + " Добавляйте своих питомцев"
	url := h.baseURL + "/contests/" + string(contestID)
	metaTags := h.buildMetaTags(contest.Title, description, url, imageURL, "", "")

	htmlBytes, err := h.readIndexHTML()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := h.injectMetaIntoHTML(htmlBytes, pageTitle, metaTags)
	out = h.injectPreviewImage(out, imageURL, contest.Title)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(out)
}

func (h *metaHTMLHandler) ServeParticipant(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || !h.canServe() {
		http.NotFound(w, r)
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	participantID := model.ParticipantID(r.PathValue("participantId"))
	if contestID == "" || participantID == "" {
		http.NotFound(w, r)
		return
	}

	participant, err := h.service.GetParticipant(r.Context(), participantID)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	contest, _ := h.service.GetContest(r.Context(), contestID)
	contestTitle := ""
	if contest != nil {
		contestTitle = contest.Title
	}
	pageTitle := participantTitleForOG(participant.PetName, contestTitle)
	description := participantDescription(participant.PetName, participant.PetDescription)

	imageURL := firstPhotoURLFromParticipant(participant)
	url := h.baseURL + "/contests/" + string(contestID) + "/participants/" + string(participantID)
	imageAlt := "Фото питомца " + participant.PetName
	metaTags := h.buildMetaTags(pageTitle, description, url, imageURL, imageAlt, "ru_RU")

	htmlBytes, err := h.readIndexHTML()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := h.injectMetaIntoHTML(htmlBytes, pageTitle, metaTags)
	out = h.injectParticipantPreviewCard(out, imageURL, pageTitle, description)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(out)
}
