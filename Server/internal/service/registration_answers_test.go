package service

import (
	"strings"
	"testing"

	"toppet/server/internal/model"
)

func TestValidateRegistrationAnswers_textareaAndImage(t *testing.T) {
	fields := []*model.RegistrationField{
		{ID: "t1", Label: "Bio", FieldType: "textarea", Required: true},
		{ID: "i1", Label: "Doc", FieldType: "image", Required: false},
	}
	t.Run("textarea ok", func(t *testing.T) {
		err := ValidateRegistrationAnswers(fields, map[string]interface{}{
			"t1": "Line1\nLine2",
		})
		if err != nil {
			t.Fatal(err)
		}
	})
	t.Run("textarea empty", func(t *testing.T) {
		err := ValidateRegistrationAnswers(fields, map[string]interface{}{
			"t1": "  \n  ",
		})
		if err == nil {
			t.Fatal("want error")
		}
	})
	t.Run("textarea too long", func(t *testing.T) {
		long := strings.Repeat("а", maxRegistrationTextareaRunes+1)
		err := ValidateRegistrationAnswers(fields, map[string]interface{}{
			"t1": long,
		})
		if err == nil {
			t.Fatal("want error")
		}
	})
	t.Run("image optional omitted", func(t *testing.T) {
		err := ValidateRegistrationAnswers(fields, map[string]interface{}{
			"t1": "ok",
		})
		if err != nil {
			t.Fatal(err)
		}
	})
	t.Run("image valid https", func(t *testing.T) {
		err := ValidateRegistrationAnswers(fields, map[string]interface{}{
			"t1": "ok",
			"i1": "https://example.com/x.png",
		})
		if err != nil {
			t.Fatal(err)
		}
	})
	t.Run("image invalid scheme", func(t *testing.T) {
		err := ValidateRegistrationAnswers(fields, map[string]interface{}{
			"t1": "ok",
			"i1": "javascript:alert(1)",
		})
		if err == nil {
			t.Fatal("want error")
		}
	})
}
