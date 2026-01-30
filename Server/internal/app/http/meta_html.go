package http

import (
	"context"
	"html"
	"net/http"
	"os"
	"sort"
	"strings"

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

func (h *metaHTMLHandler) buildMetaTags(title, description, url, imageURL string) string {
	if imageURL == "" {
		imageURL = h.defaultImageURL()
	}
	title = html.EscapeString(title)
	description = html.EscapeString(description)
	url = html.EscapeString(url)
	imageURL = html.EscapeString(imageURL)
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
	return b.String()
}

func (h *metaHTMLHandler) injectMetaIntoHTML(htmlBytes []byte, pageTitle, metaTags string) []byte {
	oldTitle := []byte("<title>Top-Pet</title>")
	newHead := []byte("<title>" + html.EscapeString(pageTitle) + "</title>\n    " + metaTags)
	return []byte(strings.Replace(string(htmlBytes), string(oldTitle), string(newHead), 1))
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
	metaTags := h.buildMetaTags(contest.Title, description, url, imageURL)

	htmlBytes, err := h.readIndexHTML()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := h.injectMetaIntoHTML(htmlBytes, pageTitle, metaTags)
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

	imageURL := firstPhotoURLFromParticipant(participant)
	pageTitle := participant.PetName + " - Top-Pet"
	description := participant.PetDescription
	if description == "" {
		description = participant.PetName
	}
	description = description + " Голосуйте за моего питомца"
	url := h.baseURL + "/contests/" + string(contestID) + "/participants/" + string(participantID)
	metaTags := h.buildMetaTags(participant.PetName, description, url, imageURL)

	htmlBytes, err := h.readIndexHTML()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := h.injectMetaIntoHTML(htmlBytes, pageTitle, metaTags)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(out)
}
