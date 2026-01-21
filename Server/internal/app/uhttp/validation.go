package uhttp

import (
	"fmt"
	"net/http"
)

func ValidateRequired(value, fieldName string) error {
	if value == "" {
		return fmt.Errorf("%s is required", fieldName)
	}
	return nil
}

func ValidateMaxLength(value string, maxLength int, fieldName string) error {
	if len(value) > maxLength {
		return fmt.Errorf("%s is too long (max %d characters)", fieldName, maxLength)
	}
	return nil
}

func ValidateString(value, fieldName string, required bool, maxLength int) error {
	if required {
		if err := ValidateRequired(value, fieldName); err != nil {
			return err
		}
	}
	if maxLength > 0 {
		if err := ValidateMaxLength(value, maxLength, fieldName); err != nil {
			return err
		}
	}
	return nil
}

func GetPathValue(r *http.Request, param string) string {
	return r.PathValue(param)
}
