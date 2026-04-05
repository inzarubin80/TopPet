package service

import (
	"fmt"
	"net/url"
	"strings"
	"unicode/utf8"

	"toppet/server/internal/model"
)

const maxRegistrationTextareaRunes = 10000

func cloneAnswersMap(m map[string]interface{}) map[string]interface{} {
	if m == nil {
		return map[string]interface{}{}
	}
	out := make(map[string]interface{}, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// ValidateRegistrationAnswers проверяет ответы по схеме полей конкурса (ключ — id поля).
func ValidateRegistrationAnswers(fields []*model.RegistrationField, answers map[string]interface{}) error {
	if len(fields) == 0 {
		if len(answers) > 0 {
			return fmt.Errorf("unexpected registration answers for contest without custom fields")
		}
		return nil
	}
	if answers == nil {
		answers = map[string]interface{}{}
	}
	fieldIDs := make(map[string]*model.RegistrationField, len(fields))
	for _, f := range fields {
		fieldIDs[f.ID] = f
	}
	for k := range answers {
		if fieldIDs[k] == nil {
			return fmt.Errorf("unknown registration field id: %s", k)
		}
	}
	for _, f := range fields {
		raw, ok := answers[f.ID]
		if !ok || raw == nil {
			if f.Required {
				return fmt.Errorf("registration field %q is required", f.Label)
			}
			continue
		}
		if err := validateOneAnswer(f, raw); err != nil {
			return fmt.Errorf("field %q: %w", f.Label, err)
		}
	}
	return nil
}

func validateOneAnswer(f *model.RegistrationField, raw interface{}) error {
	switch f.FieldType {
	case "string":
		s, ok := raw.(string)
		if !ok {
			return fmt.Errorf("expected string")
		}
		if strings.TrimSpace(s) == "" {
			return fmt.Errorf("value cannot be empty")
		}
		return nil
	case "textarea":
		s, ok := raw.(string)
		if !ok {
			return fmt.Errorf("expected string")
		}
		t := strings.TrimSpace(s)
		if t == "" {
			return fmt.Errorf("value cannot be empty")
		}
		if utf8.RuneCountInString(t) > maxRegistrationTextareaRunes {
			return fmt.Errorf("text is too long (max %d characters)", maxRegistrationTextareaRunes)
		}
		return nil
	case "image":
		s, ok := raw.(string)
		if !ok {
			return fmt.Errorf("expected string (image URL)")
		}
		s = strings.TrimSpace(s)
		if s == "" {
			return fmt.Errorf("value cannot be empty")
		}
		u, err := url.Parse(s)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return fmt.Errorf("value must be a valid http(s) URL")
		}
		return nil
	case "number":
		switch raw.(type) {
		case float64, int, int64:
			return nil
		default:
			return fmt.Errorf("expected number")
		}
	case "boolean":
		if _, ok := raw.(bool); !ok {
			return fmt.Errorf("expected boolean")
		}
		return nil
	case "enum":
		s, ok := raw.(string)
		if !ok {
			return fmt.Errorf("expected string (enum option)")
		}
		for _, opt := range f.EnumOptions {
			if opt == s {
				return nil
			}
		}
		return fmt.Errorf("value must be one of enum options")
	default:
		return fmt.Errorf("unknown field type")
	}
}
