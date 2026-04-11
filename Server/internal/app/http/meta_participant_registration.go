package http

import (
	"encoding/json"
	"html"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"toppet/server/internal/model"
)

var (
	registrationImageExtRe = regexp.MustCompile(`(?i)\.(png|jpe?g|gif|webp|svg|bmp)(\?|#|$)`)
	hexDigitsOnlyRe        = regexp.MustCompile(`^[a-fA-F0-9]+$`)
)

func shortRegistrationKeyLabel(id string) string {
	hex := strings.ReplaceAll(id, "-", "")
	if len(hex) == 32 && hexDigitsOnlyRe.MatchString(hex) {
		if len(id) >= 8 {
			return id[:8]
		}
	}
	if utf8.RuneCountInString(id) > 16 {
		rs := []rune(id)
		return string(rs[:12]) + "…"
	}
	return id
}

func isPresentRegistrationAnswer(raw interface{}) bool {
	if raw == nil {
		return false
	}
	switch v := raw.(type) {
	case string:
		return strings.TrimSpace(v) != ""
	case float64:
		return !math.IsNaN(v)
	case bool:
		return true
	default:
		return true
	}
}

func formatBoolAnswer(raw interface{}) string {
	if raw == true || raw == "true" {
		return "Да"
	}
	return "Нет"
}

func formatNumberAnswer(raw interface{}) string {
	switch v := raw.(type) {
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case string:
		s := strings.TrimSpace(v)
		if s == "" {
			return ""
		}
		return s
	default:
		return strings.TrimSpace(toScalarString(raw))
	}
}

func toScalarString(raw interface{}) string {
	switch v := raw.(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		if v {
			return "true"
		}
		return "false"
	case json.Number:
		return v.String()
	default:
		b, err := json.Marshal(raw)
		if err != nil {
			return ""
		}
		return string(b)
	}
}

func looksLikeOrphanImageURL(s string) bool {
	t := strings.TrimSpace(s)
	if t == "" || strings.ContainsAny(t, "\n\r\t") {
		return false
	}
	return registrationImageExtRe.MatchString(strings.ToLower(t))
}

func formatSchemaValue(baseURL string, f *model.RegistrationField, raw interface{}) (plain string, imgSrc string) {
	switch f.FieldType {
	case "boolean":
		return formatBoolAnswer(raw), ""
	case "number":
		return formatNumberAnswer(raw), ""
	case "image":
		s := strings.TrimSpace(toScalarString(raw))
		if s == "" {
			return "", ""
		}
		return "", absoluteAssetURLForPreview(baseURL, s)
	case "textarea":
		s := strings.TrimSpace(toScalarString(raw))
		return s, ""
	default:
		return strings.TrimSpace(toScalarString(raw)), ""
	}
}

func formatOrphanValue(baseURL string, raw interface{}) (plain string, imgSrc string, isTextarea bool) {
	switch v := raw.(type) {
	case bool:
		return formatBoolAnswer(v), "", false
	case float64:
		if math.IsNaN(v) {
			return "", "", false
		}
		return strconv.FormatFloat(v, 'f', -1, 64), "", false
	case string:
		t := strings.TrimSpace(v)
		if t == "" {
			return "", "", false
		}
		if looksLikeOrphanImageURL(t) {
			return "", absoluteAssetURLForPreview(baseURL, t), false
		}
		if strings.Contains(t, "\n") {
			return t, "", true
		}
		return t, "", false
	default:
		b, err := json.Marshal(raw)
		if err != nil {
			return toScalarString(raw), "", false
		}
		return string(b), "", true
	}
}

func absoluteAssetURLForPreview(baseURL, u string) string {
	u = strings.TrimSpace(u)
	if u == "" {
		return ""
	}
	if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
		return u
	}
	base := strings.TrimSuffix(baseURL, "/")
	path := strings.TrimPrefix(u, "/")
	return base + "/" + path
}

type registrationPreviewRow struct {
	label      string
	labelTitle string
	plain      string
	imgSrc     string
	textarea   bool
}

// participantRegistrationPreviewHTML builds escaped HTML for "Поля заявки" + optional orphans (same idea as client registrationAnswersDisplay).
func participantRegistrationPreviewHTML(baseURL string, fields []*model.RegistrationField, answers map[string]interface{}) string {
	if len(answers) == 0 {
		return ""
	}

	fieldByID := make(map[string]*model.RegistrationField, len(fields))
	for _, f := range fields {
		if f != nil {
			fieldByID[f.ID] = f
		}
	}

	sortedFields := append([]*model.RegistrationField(nil), fields...)
	sort.Slice(sortedFields, func(i, j int) bool {
		if sortedFields[i] == nil {
			return true
		}
		if sortedFields[j] == nil {
			return false
		}
		return sortedFields[i].SortOrder < sortedFields[j].SortOrder
	})

	var schemaRows []registrationPreviewRow
	for _, f := range sortedFields {
		if f == nil {
			continue
		}
		raw, ok := answers[f.ID]
		if !ok || !isPresentRegistrationAnswer(raw) {
			continue
		}
		plain, img := formatSchemaValue(baseURL, f, raw)
		if f.FieldType == "image" {
			if img == "" {
				continue
			}
			schemaRows = append(schemaRows, registrationPreviewRow{
				label:      f.Label,
				labelTitle: "",
				plain:      "",
				imgSrc:     img,
				textarea:   false,
			})
			continue
		}
		if strings.TrimSpace(plain) == "" {
			continue
		}
		schemaRows = append(schemaRows, registrationPreviewRow{
			label:      f.Label,
			labelTitle: "",
			plain:      plain,
			imgSrc:     "",
			textarea:   f.FieldType == "textarea",
		})
	}

	var orphanKeys []string
	for k := range answers {
		if fieldByID[k] == nil {
			orphanKeys = append(orphanKeys, k)
		}
	}
	sort.Strings(orphanKeys)

	var orphanRows []registrationPreviewRow
	for _, k := range orphanKeys {
		raw := answers[k]
		if !isPresentRegistrationAnswer(raw) {
			continue
		}
		plain, img, isTA := formatOrphanValue(baseURL, raw)
		if img != "" {
			orphanRows = append(orphanRows, registrationPreviewRow{
				label:      "Доп. поле · " + shortRegistrationKeyLabel(k),
				labelTitle: k,
				plain:      "",
				imgSrc:     img,
				textarea:   false,
			})
			continue
		}
		if strings.TrimSpace(plain) == "" {
			continue
		}
		orphanRows = append(orphanRows, registrationPreviewRow{
			label:      "Доп. поле · " + shortRegistrationKeyLabel(k),
			labelTitle: k,
			plain:      plain,
			imgSrc:     "",
			textarea:   isTA,
		})
	}

	if len(schemaRows) == 0 && len(orphanRows) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString(`<div style="margin-top:18px;padding-top:18px;border-top:1px solid #e5e7eb;text-align:left;">`)

	if len(schemaRows) > 0 {
		b.WriteString(`<p style="margin:0 0 12px;font-size:0.8125rem;font-weight:600;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.04em;">Поля заявки</p>`)
		writeRegistrationPreviewRows(&b, schemaRows, false)
	}

	if len(orphanRows) > 0 {
		top := "16px"
		if len(schemaRows) > 0 {
			top = "20px"
		}
		b.WriteString(`<p style="margin:` + top + ` 0 12px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:0.875rem;font-weight:600;color:#475569;">Дополнительные данные заявки</p>`)
		writeRegistrationPreviewRows(&b, orphanRows, true)
	}

	b.WriteString(`</div>`)
	return b.String()
}

func writeRegistrationPreviewRows(b *strings.Builder, rows []registrationPreviewRow, withTitleAttr bool) {
	for i, row := range rows {
		top := "12px"
		pt := "12px"
		bt := "1px solid #f3f4f6"
		if i == 0 {
			top = "0"
			pt = "0"
			bt = "none"
		}
		b.WriteString(`<div style="margin-top:` + top + `;padding-top:` + pt + `;border-top:` + bt + `;">`)
		titleAttr := ""
		if withTitleAttr && row.labelTitle != "" {
			titleAttr = ` title="` + html.EscapeString(row.labelTitle) + `"`
		}
		b.WriteString(`<div style="font-size:0.8125rem;font-weight:600;color:#64748b;line-height:1.4;"` + titleAttr + `>`)
		b.WriteString(html.EscapeString(row.label))
		b.WriteString(`</div>`)
		b.WriteString(`<div style="margin-top:6px;font-size:0.9375rem;font-weight:500;color:#0f172a;line-height:1.45;word-break:break-word;">`)
		if row.imgSrc != "" {
			esc := html.EscapeString(row.imgSrc)
			b.WriteString(`<img src="`)
			b.WriteString(esc)
			b.WriteString(`" alt="" style="max-width:100%;max-height:280px;border-radius:8px;border:1px solid #e2e8f0;object-fit:contain;" />`)
		} else if row.textarea {
			b.WriteString(`<span style="white-space:pre-wrap;">`)
			b.WriteString(html.EscapeString(row.plain))
			b.WriteString(`</span>`)
		} else {
			b.WriteString(html.EscapeString(row.plain))
		}
		b.WriteString(`</div></div>`)
	}
}
