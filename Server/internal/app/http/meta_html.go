package http

import (
	"context"
	"html"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"toppet/server/internal/app/logger"
	"toppet/server/internal/model"
)

type (
	serviceMetaHTML interface {
		GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error)
		ListNominations(ctx context.Context, contestID model.ContestID) ([]*model.Nomination, error)
		ListParticipantsByContest(ctx context.Context, contestID model.ContestID, viewer *model.UserID, nominationFilter *model.ParticipantListNominationFilter, juryUnscoredOnly bool, participantScope string, submissionFilter string, votedByViewerOnly bool, favoriteOnly bool, limit, offset int32, sort string) ([]*model.Participant, int64, error)
		GetParticipant(ctx context.Context, participantID model.ParticipantID, viewer *model.UserID) (*model.Participant, error)
		ListContestRegistrationFields(ctx context.Context, contestID model.ContestID) ([]*model.RegistrationField, error)
	}

	metaHTMLHandler struct {
		baseURL      string
		spaIndexPath string
		service      serviceMetaHTML
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

// writeHTMLResponse sends the same headers as GET; for HEAD the body is omitted (RFC 7231).
func writeHTMLResponse(w http.ResponseWriter, r *http.Request, out []byte) {
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Content-Length", strconv.Itoa(len(out)))
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	w.Write(out)
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

// firstPhotoURLForOG returns URL for og:image: prefers ThumbURL when set (lighter for crawlers), else URL.
func firstPhotoURLForOG(p *model.Participant) string {
	if p == nil || len(p.Photos) == 0 {
		return ""
	}
	photos := make([]*model.Photo, len(p.Photos))
	copy(photos, p.Photos)
	sort.Slice(photos, func(i, j int) bool { return photos[i].Position < photos[j].Position })
	first := photos[0]
	if first.ThumbURL != nil && *first.ThumbURL != "" {
		return *first.ThumbURL
	}
	return first.URL
}

func (h *metaHTMLHandler) defaultImageURL() string {
	return h.baseURL + "/og-default.png"
}

// absoluteImageURL returns imageURL as-is if it's already absolute (http/https), otherwise baseURL + path.
// Telegram and other crawlers require og:image to be an absolute HTTPS URL.
func (h *metaHTMLHandler) absoluteImageURL(imageURL string) string {
	if imageURL == "" {
		return ""
	}
	if strings.HasPrefix(imageURL, "http://") || strings.HasPrefix(imageURL, "https://") {
		return imageURL
	}
	base := strings.TrimSuffix(h.baseURL, "/")
	path := strings.TrimPrefix(imageURL, "/")
	return base + "/" + path
}

const (
	ogTitleMaxRunes             = 60
	ogDescriptionMaxRunes       = 160
	participantDescBodyMaxRunes = 100 // max runes for entry description body so CTA fits in card preview
	ogParticipantTitleMaxRunes  = 50  // participant card title often shown in one line
	participantCTASuffix        = " Участвуйте в конкурсе на ShotContest!"
	contestDescSuffix           = " Участвуйте и следите за результатами"
	nominationsPreviewMaxChips  = 4
	metaPrizeLineMaxRunes       = 120
)

func isValidContestThemeColor(s string) bool {
	if len(s) != 7 || s[0] != '#' {
		return false
	}
	for i := 1; i < 7; i++ {
		c := s[i]
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') {
			continue
		}
		return false
	}
	return true
}

func contestStatusLabelRU(s model.ContestStatus) string {
	switch s {
	case model.ContestStatusDraft:
		return "Черновик"
	case model.ContestStatusPublication:
		return "Публикация"
	case model.ContestStatusRegistration:
		return "Регистрация"
	case model.ContestStatusVoting:
		return "Голосование"
	case model.ContestStatusFinished:
		return "Завершён"
	default:
		return string(s)
	}
}

func contestStatusBadgeColors(s model.ContestStatus) (bg, fg string) {
	switch s {
	case model.ContestStatusDraft:
		return "#f3f4f6", "#6b7280"
	case model.ContestStatusPublication:
		return "#e0e7ff", "#3730a3"
	case model.ContestStatusRegistration:
		return "#fef3c7", "#92400e"
	case model.ContestStatusVoting:
		return "#dcfce7", "#166534"
	case model.ContestStatusFinished:
		return "#fee2e2", "#b91c1c"
	default:
		return "#f3f4f6", "#374151"
	}
}

func formatContestLocalTime(t time.Time, tzName string) string {
	tzName = strings.TrimSpace(tzName)
	if tzName != "" {
		if loc, err := time.LoadLocation(tzName); err == nil {
			return t.In(loc).Format("02.01.2006 15:04")
		}
	}
	return t.UTC().Format("02.01.2006 15:04") + " UTC"
}

// metaContestScheduleLine returns one human-readable schedule line for the preview card (empty if no dates).
func metaContestScheduleLine(c *model.Contest) string {
	if c == nil {
		return ""
	}
	fmtT := func(t *time.Time) string {
		if t == nil {
			return ""
		}
		return formatContestLocalTime(*t, c.ScheduleTimezone)
	}
	if c.VotingStartsAt != nil && c.VotingEndsAt != nil {
		return "Голосование: " + fmtT(c.VotingStartsAt) + " — " + fmtT(c.VotingEndsAt)
	}
	if c.VotingEndsAt != nil {
		return "Голосование до " + fmtT(c.VotingEndsAt)
	}
	if c.VotingStartsAt != nil {
		return "Голосование с " + fmtT(c.VotingStartsAt)
	}
	if c.RegistrationStartsAt != nil {
		return "Регистрация с " + fmtT(c.RegistrationStartsAt)
	}
	if c.PublicationStartsAt != nil {
		return "Публикация с " + fmtT(c.PublicationStartsAt)
	}
	return ""
}

// contestPreviewCardData drives the visible HTML card for contest and home meta pages.
type contestPreviewCardData struct {
	ImageURL         string
	Title            string
	BodyText         string // plain text; escaped when rendered
	NominationTitles []string
	CanonicalURL     string
	ThemeColor       string               // optional #rrggbb
	StatusBadge      *model.ContestStatus // nil = no badge
	ScheduleLine     string
	PrizeLine        string
	TotalVotes       int64
	ShowFullDescHint bool
	CTALabel         string
}

func (h *metaHTMLHandler) buildMetaTags(title, description, url, imageURL, imageAlt, locale string, imageWidth, imageHeight int, imageSecureURL string) string {
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	}
	title = html.EscapeString(title)
	description = html.EscapeString(description)
	url = html.EscapeString(url)
	imageURL = html.EscapeString(imageURL)
	imageAlt = html.EscapeString(imageAlt)
	imageSecureURL = html.EscapeString(imageSecureURL)
	const siteName = "ShotContest"
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
	if imageWidth > 0 && imageHeight > 0 {
		b.WriteString(`<meta property="og:image:width" content="`)
		b.WriteString(strings.TrimSpace(strconv.Itoa(imageWidth)))
		b.WriteString(`">`)
		b.WriteString(`<meta property="og:image:height" content="`)
		b.WriteString(strings.TrimSpace(strconv.Itoa(imageHeight)))
		b.WriteString(`">`)
	}
	if imageSecureURL != "" {
		b.WriteString(`<meta property="og:image:secure_url" content="`)
		b.WriteString(imageSecureURL)
		b.WriteString(`">`)
	}
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

func (h *metaHTMLHandler) injectMetaIntoHTML(htmlBytes []byte, pageTitle, metaTags, canonicalURL string) []byte {
	oldTitle := []byte("<title>ShotContest</title>")
	canonicalTag := ""
	if canonicalURL != "" {
		canonicalURL = html.EscapeString(canonicalURL)
		canonicalTag = "\n    <link rel=\"canonical\" href=\"" + canonicalURL + "\">"
	}
	newHead := []byte("<title>" + html.EscapeString(pageTitle) + "</title>\n    " + metaTags + canonicalTag)
	return []byte(strings.Replace(string(htmlBytes), string(oldTitle), string(newHead), 1))
}

// contestDescription builds og:description for contest: one line from contestDesc (or contestTitle if empty) + suffix, max 160 runes.
func contestDescription(contestTitle, contestDesc string) string {
	if contestDesc == "" {
		contestDesc = contestTitle
	}
	oneLine := strings.TrimSpace(strings.ReplaceAll(contestDesc, "\n", " "))
	oneLine = strings.Join(strings.Fields(oneLine), " ")
	maxDesc := ogDescriptionMaxRunes - utf8.RuneCountInString(contestDescSuffix)
	if utf8.RuneCountInString(oneLine) > maxDesc {
		oneLine = truncateRunes(oneLine, maxDesc)
	}
	return oneLine + contestDescSuffix
}

// participantTitleForOG returns submission title (truncated to ogParticipantTitleMaxRunes).
func participantTitleForOG(entryTitle string) string {
	return truncateRunes(entryTitle, ogParticipantTitleMaxRunes)
}

// participantDescription builds og:description from submission description + CTA.
func participantDescription(entryTitle, entryDescription string) string {
	cta := participantCTASuffix
	if entryDescription == "" {
		return truncateRunes("Заявка «"+entryTitle+"» на ShotContest.", ogDescriptionMaxRunes)
	}
	oneLine := strings.TrimSpace(strings.ReplaceAll(entryDescription, "\n", " "))
	oneLine = strings.Join(strings.Fields(oneLine), " ")
	if utf8.RuneCountInString(oneLine) > participantDescBodyMaxRunes {
		oneLine = truncateRunes(oneLine, participantDescBodyMaxRunes)
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

// nominationsChipsHTML renders nomination titles as chips (max nominationsPreviewMaxChips + «ещё N»).
func nominationsChipsHTML(titles []string) string {
	var nonempty []string
	for _, t := range titles {
		t = strings.TrimSpace(t)
		if t != "" {
			nonempty = append(nonempty, t)
		}
	}
	if len(nonempty) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString(`<p style="margin:12px 0 6px;font-size:0.8125rem;font-weight:600;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.02em;">Номинации</p><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;">`)
	show := nonempty
	extra := 0
	if len(show) > nominationsPreviewMaxChips {
		extra = len(show) - nominationsPreviewMaxChips
		show = show[:nominationsPreviewMaxChips]
	}
	for _, t := range show {
		b.WriteString(`<span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:0.875rem;line-height:1.3;">`)
		b.WriteString(html.EscapeString(t))
		b.WriteString(`</span>`)
	}
	b.WriteString(`</div>`)
	if extra > 0 {
		b.WriteString(`<p style="margin:8px 0 0;font-size:0.8125rem;color:#6b7280;">ещё `)
		b.WriteString(strconv.Itoa(extra))
		b.WriteString(`</p>`)
	}
	return b.String()
}

// injectContestPreviewCard inserts a card (image + title + description + optional CTA) after <body>.
func (h *metaHTMLHandler) injectContestPreviewCard(htmlBytes []byte, d contestPreviewCardData) []byte {
	imageURL := strings.TrimSpace(d.ImageURL)
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	}
	imageURL = html.EscapeString(imageURL)
	title := html.EscapeString(d.Title)
	body := html.EscapeString(d.BodyText)
	canonical := html.EscapeString(strings.TrimSpace(d.CanonicalURL))
	ctaLabel := strings.TrimSpace(d.CTALabel)
	if ctaLabel == "" {
		ctaLabel = "Открыть на ShotContest"
	}
	ctaLabelEsc := html.EscapeString(ctaLabel)

	accent := strings.TrimSpace(d.ThemeColor)
	if !isValidContestThemeColor(accent) {
		accent = ""
	}
	cardBorder := ""
	if accent != "" {
		cardBorder = `border-left:4px solid ` + html.EscapeString(accent) + `;`
	}

	var inner strings.Builder
	inner.WriteString(`<div style="text-align:left;max-width:520px;margin:0 auto;">`)
	inner.WriteString(`<img src="`)
	inner.WriteString(imageURL)
	inner.WriteString(`" alt="`)
	inner.WriteString(title)
	inner.WriteString(`" style="width:100%;max-height:220px;object-fit:cover;display:block;margin:0 0 16px;border-radius:8px;" />`)
	inner.WriteString(`<h1 style="margin:0 0 10px;font-size:1.5rem;font-weight:600;color:#1a1a1a;text-align:center;">`)
	inner.WriteString(title)
	inner.WriteString(`</h1>`)

	if d.StatusBadge != nil {
		lbl := contestStatusLabelRU(*d.StatusBadge)
		if lbl != "" {
			bg, fg := contestStatusBadgeColors(*d.StatusBadge)
			inner.WriteString(`<p style="margin:0 0 8px;text-align:center;"><span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:0.75rem;font-weight:600;background:`)
			inner.WriteString(bg)
			inner.WriteString(`;color:`)
			inner.WriteString(fg)
			inner.WriteString(`;">`)
			inner.WriteString(html.EscapeString(lbl))
			inner.WriteString(`</span></p>`)
		}
	}

	if sched := strings.TrimSpace(d.ScheduleLine); sched != "" {
		inner.WriteString(`<p style="margin:0 0 8px;font-size:0.875rem;line-height:1.45;color:#374151;text-align:center;">`)
		inner.WriteString(html.EscapeString(sched))
		inner.WriteString(`</p>`)
	}

	if d.TotalVotes > 0 {
		inner.WriteString(`<p style="margin:0 0 8px;font-size:0.875rem;color:#6b7280;text-align:center;">Голосов: `)
		inner.WriteString(strconv.FormatInt(d.TotalVotes, 10))
		inner.WriteString(`</p>`)
	}

	if prize := strings.TrimSpace(d.PrizeLine); prize != "" {
		inner.WriteString(`<p style="margin:0 0 10px;font-size:0.875rem;line-height:1.45;color:#1f2937;font-weight:500;text-align:center;">`)
		inner.WriteString(html.EscapeString(prize))
		inner.WriteString(`</p>`)
	}

	inner.WriteString(`<p style="margin:0 0 10px;font-size:1rem;line-height:1.5;color:#444;">`)
	inner.WriteString(body)
	inner.WriteString(`</p>`)

	if d.ShowFullDescHint {
		inner.WriteString(`<p style="margin:0 0 14px;font-size:0.8125rem;line-height:1.4;color:#9ca3af;">Полное описание — на странице конкурса.</p>`)
	}

	inner.WriteString(nominationsChipsHTML(d.NominationTitles))

	ctaBg := "#2563eb"
	ctaFg := "#ffffff"
	if accent != "" {
		ctaBg = accent
	}
	if canonical != "" {
		inner.WriteString(`<p style="margin:18px 0 0;text-align:center;"><a href="`)
		inner.WriteString(canonical)
		inner.WriteString(`" style="display:inline-block;padding:10px 20px;border-radius:8px;background:`)
		inner.WriteString(ctaBg)
		inner.WriteString(`;color:`)
		inner.WriteString(ctaFg)
		inner.WriteString(`;font-size:0.9375rem;font-weight:600;text-decoration:none;">`)
		inner.WriteString(ctaLabelEsc)
		inner.WriteString(`</a></p>`)
	}

	inner.WriteString(`</div>`)

	var block strings.Builder
	block.WriteString(`<div id="og-preview" style="text-align:center;max-width:600px;margin:0 auto;padding:24px;background:linear-gradient(180deg,#fafafa 0%,#f3f4f6 100%);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);`)
	block.WriteString(cardBorder)
	block.WriteString(`">`)
	block.WriteString(inner.String())
	block.WriteString(`</div>`)

	oldBody := "<body>"
	newBody := "<body>\n  " + block.String()
	return []byte(strings.Replace(string(htmlBytes), oldBody, newBody, 1))
}

// injectParticipantPreviewCard inserts a card (image + title + description + optional registration fields block) after <body> for participant pages.
func (h *metaHTMLHandler) injectParticipantPreviewCard(htmlBytes []byte, imageURL, title, description, registrationHTML string) []byte {
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	}
	imageURL = html.EscapeString(imageURL)
	title = html.EscapeString(title)
	description = html.EscapeString(description)
	var block strings.Builder
	block.WriteString(`<div id="og-preview" style="text-align:center;max-width:600px;margin:0 auto;padding:24px;background:#f8f9fa;font-family:system-ui,-apple-system,sans-serif;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><img src="`)
	block.WriteString(imageURL)
	block.WriteString(`" alt="`)
	block.WriteString(title)
	block.WriteString(`" style="max-width:100%;height:auto;display:block;margin:0 auto 16px;border-radius:8px;" /><h1 style="margin:0 0 12px;font-size:1.5rem;font-weight:600;color:#1a1a1a;">`)
	block.WriteString(title)
	block.WriteString(`</h1><p style="margin:0 0 16px;font-size:1rem;line-height:1.5;color:#444;">`)
	block.WriteString(description)
	block.WriteString(`</p>`)
	if registrationHTML != "" {
		block.WriteString(registrationHTML)
	}
	block.WriteString(`</div>`)
	oldBody := "<body>"
	newBody := "<body>\n  " + block.String()
	return []byte(strings.Replace(string(htmlBytes), oldBody, newBody, 1))
}

// homeMetaTitle and homeMetaDescription are default og values for the main page.
const (
	homeMetaTitle       = "ShotContest — платформа конкурсов"
	homeMetaDescription = "ShotContest — платформа конкурсов. Участвуйте в конкурсах, голосуйте за работы."
)

func (h *metaHTMLHandler) ServeHome(w http.ResponseWriter, r *http.Request) {
	if (r.Method != http.MethodGet && r.Method != http.MethodHead) || r.URL.Path != "/" || !h.canServe() {
		http.NotFound(w, r)
		return
	}
	pageTitle := truncateRunes(homeMetaTitle, ogTitleMaxRunes)
	description := truncateRunes(homeMetaDescription, ogDescriptionMaxRunes)
	url := h.baseURL + "/"
	imageURL := h.defaultImageURL()
	imageAlt := "ShotContest — платформа конкурсов"
	imageWidth, imageHeight := 1200, 630
	imageSecureURL := ""
	if strings.HasPrefix(h.baseURL, "https://") {
		imageSecureURL = imageURL
	}
	metaTags := h.buildMetaTags(pageTitle, description, url, imageURL, imageAlt, "ru_RU", imageWidth, imageHeight, imageSecureURL)

	htmlBytes, err := h.readIndexHTML()
	if err != nil {
		logger.Error("meta HTML ServeHome: failed to read index.html", "path", h.spaIndexPath, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := h.injectMetaIntoHTML(htmlBytes, pageTitle, metaTags, url)
	// Карточка с заголовком и текстом — иначе при мелком og-default.png страница выглядит пустой
	out = h.injectContestPreviewCard(out, contestPreviewCardData{
		ImageURL:         imageURL,
		Title:            pageTitle,
		BodyText:         description,
		CanonicalURL:     url,
		ShowFullDescHint: false,
		CTALabel:         "Перейти на ShotContest",
	})
	writeHTMLResponse(w, r, out)
}

func (h *metaHTMLHandler) ServeContest(w http.ResponseWriter, r *http.Request) {
	if (r.Method != http.MethodGet && r.Method != http.MethodHead) || !h.canServe() {
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

	var nominationTitles []string
	if noms, err := h.service.ListNominations(r.Context(), contestID); err != nil {
		logger.Error("meta HTML ServeContest: ListNominations", "contestId", contestID, "error", err)
	} else {
		for _, n := range noms {
			if n == nil {
				continue
			}
			nominationTitles = append(nominationTitles, n.Title)
		}
	}

	participants, _, _ := h.service.ListParticipantsByContest(r.Context(), contestID, nil, nil, false, model.ParticipantListScopeAll, model.ParticipantListSubmissionAccepted, false, false, 8, 0, "")
	imageURL := strings.TrimSpace(contest.CoverUrl)
	if imageURL != "" {
		imageURL = h.absoluteImageURL(imageURL)
	} else {
		imageURL = firstParticipantPhotoURL(participants)
		if imageURL == "" {
			imageURL = h.defaultImageURL()
		} else {
			imageURL = h.absoluteImageURL(imageURL)
		}
	}

	pageTitle := truncateRunes(contest.Title+" — ShotContest", ogTitleMaxRunes)
	description := contestDescription(contest.Title, contest.Description)
	if t := strings.TrimSpace(contest.Tagline); t != "" {
		description = truncateRunes(t+" — "+description, ogDescriptionMaxRunes)
	}
	url := h.baseURL + "/contests/" + string(contestID)
	imageAlt := "Превью конкурса: " + contest.Title
	if contest.Title == "" {
		imageAlt = "Конкурс ShotContest"
	}
	imageAlt = truncateRunes(imageAlt, 100)
	// og:image:width/height только для известного og-default.png; иначе ложные 1200×630 ломают превью (Telegram и др.).
	imageWidth, imageHeight := 0, 0
	imageSecureURL := ""
	if imageURL == h.defaultImageURL() {
		imageWidth, imageHeight = 1200, 630
		if strings.HasPrefix(h.baseURL, "https://") {
			imageSecureURL = imageURL
		}
	} else if strings.HasPrefix(imageURL, "https://") {
		imageSecureURL = imageURL
	}
	metaTags := h.buildMetaTags(pageTitle, description, url, imageURL, imageAlt, "ru_RU", imageWidth, imageHeight, imageSecureURL)

	htmlBytes, err := h.readIndexHTML()
	if err != nil {
		logger.Error("meta HTML ServeContest: failed to read index.html", "path", h.spaIndexPath, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := h.injectMetaIntoHTML(htmlBytes, pageTitle, metaTags, url)

	eff := *contest
	model.ApplyEffectiveContestStatus(&eff, time.Now().UTC())
	st := eff.Status

	cta := strings.TrimSpace(contest.CtaLabelOverride)
	if cta == "" {
		cta = "Открыть конкурс на ShotContest"
	}
	prize := strings.TrimSpace(contest.PrizeText)
	if utf8.RuneCountInString(prize) > metaPrizeLineMaxRunes {
		prize = truncateRunes(prize, metaPrizeLineMaxRunes)
	}

	out = h.injectContestPreviewCard(out, contestPreviewCardData{
		ImageURL:         imageURL,
		Title:            pageTitle,
		BodyText:         description,
		NominationTitles: nominationTitles,
		CanonicalURL:     url,
		ThemeColor:       strings.TrimSpace(contest.ThemeColor),
		StatusBadge:      &st,
		ScheduleLine:     metaContestScheduleLine(contest),
		PrizeLine:        prize,
		TotalVotes:       contest.TotalVotes,
		ShowFullDescHint: true,
		CTALabel:         cta,
	})
	writeHTMLResponse(w, r, out)
}

func (h *metaHTMLHandler) ServeParticipant(w http.ResponseWriter, r *http.Request) {
	if (r.Method != http.MethodGet && r.Method != http.MethodHead) || !h.canServe() {
		http.NotFound(w, r)
		return
	}
	contestID := model.ContestID(r.PathValue("contestId"))
	participantID := model.ParticipantID(r.PathValue("participantId"))
	if contestID == "" || participantID == "" {
		http.NotFound(w, r)
		return
	}

	participant, err := h.service.GetParticipant(r.Context(), participantID, nil)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	entryTitle := strings.TrimSpace(participant.EntryTitle)
	if entryTitle == "" {
		entryTitle = participant.PetName
	}
	if entryTitle == "" {
		entryTitle = "Заявка участника"
	}
	entryDescription := strings.TrimSpace(participant.EntryDescription)
	if entryDescription == "" {
		entryDescription = participant.PetDescription
	}
	pageTitle := participantTitleForOG(entryTitle)
	description := participantDescription(entryTitle, entryDescription)

	// Prefer thumbnail for og:image so crawlers get a lighter image (heavy full-size can break preview)
	imageURL := firstPhotoURLForOG(participant)
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	} else {
		imageURL = h.absoluteImageURL(imageURL)
	}
	url := h.baseURL + "/contests/" + string(contestID) + "/participants/" + string(participantID)
	imageAlt := "Изображение заявки: " + entryTitle
	imageWidth, imageHeight := 0, 0
	imageSecureURL := ""
	if imageURL == h.defaultImageURL() {
		imageWidth, imageHeight = 1200, 630
		if strings.HasPrefix(h.baseURL, "https://") {
			imageSecureURL = imageURL
		}
	} else if strings.HasPrefix(imageURL, "https://") {
		imageSecureURL = imageURL
	}
	metaTags := h.buildMetaTags(pageTitle, description, url, imageURL, imageAlt, "ru_RU", imageWidth, imageHeight, imageSecureURL)

	htmlBytes, err := h.readIndexHTML()
	if err != nil {
		logger.Error("meta HTML ServeParticipant: failed to read index.html", "path", h.spaIndexPath, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var regHTML string
	fields, err := h.service.ListContestRegistrationFields(r.Context(), contestID)
	if err != nil {
		logger.Warn("meta HTML ServeParticipant: ListContestRegistrationFields failed", "error", err)
	} else {
		ans := participant.RegistrationAnswers
		if ans == nil {
			ans = map[string]interface{}{}
		}
		regHTML = participantRegistrationPreviewHTML(h.baseURL, fields, ans)
	}

	out := h.injectMetaIntoHTML(htmlBytes, pageTitle, metaTags, url)
	out = h.injectParticipantPreviewCard(out, imageURL, pageTitle, description, regHTML)
	writeHTMLResponse(w, r, out)
}
