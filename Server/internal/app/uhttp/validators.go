package uhttp

import (
	"fmt"
	"regexp"
	"strings"
)

// Validator представляет функцию валидации
type Validator func(value interface{}) error

// ValidateString валидирует строковое значение
func ValidateString(value string, fieldName string, required bool, maxLength int, validators ...Validator) error {
	if required && value == "" {
		return NewBadRequestError(fmt.Sprintf("%s is required", fieldName), nil)
	}

	if value == "" {
		return nil // Пустая строка допустима если не required
	}

	if maxLength > 0 && len(value) > maxLength {
		return NewBadRequestError(fmt.Sprintf("%s is too long (max %d characters)", fieldName, maxLength), nil)
	}

	// Применяем дополнительные валидаторы
	for _, validator := range validators {
		if err := validator(value); err != nil {
			return err
		}
	}

	return nil
}

// ValidateRequired проверяет, что значение не пустое
func ValidateRequired(value, fieldName string) error {
	if value == "" {
		return NewBadRequestError(fmt.Sprintf("%s is required", fieldName), nil)
	}
	return nil
}

// ValidateMaxLength проверяет максимальную длину строки
func ValidateMaxLength(value string, maxLength int, fieldName string) error {
	if len(value) > maxLength {
		return NewBadRequestError(fmt.Sprintf("%s is too long (max %d characters)", fieldName, maxLength), nil)
	}
	return nil
}

// ValidateMinLength проверяет минимальную длину строки
func ValidateMinLength(value string, minLength int, fieldName string) error {
	if len(value) < minLength {
		return NewBadRequestError(fmt.Sprintf("%s is too short (min %d characters)", fieldName, minLength), nil)
	}
	return nil
}

// ValidateEmail проверяет формат email
func ValidateEmail(email string) error {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return NewBadRequestError("invalid email format", nil)
	}
	return nil
}

// ValidateURL проверяет формат URL
func ValidateURL(url string) error {
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return NewBadRequestError("invalid URL format", nil)
	}
	return nil
}

// ValidateUUID проверяет формат UUID
func ValidateUUID(uuid string) error {
	uuidRegex := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	if !uuidRegex.MatchString(strings.ToLower(uuid)) {
		return NewBadRequestError("invalid UUID format", nil)
	}
	return nil
}

// ValidateIntRange проверяет, что число находится в заданном диапазоне
func ValidateIntRange(value, min, max int, fieldName string) error {
	if value < min || value > max {
		return NewBadRequestError(fmt.Sprintf("%s must be between %d and %d", fieldName, min, max), nil)
	}
	return nil
}

// ValidateStringLength проверяет длину строки в заданном диапазоне
func ValidateStringLength(value string, min, max int, fieldName string) error {
	length := len(value)
	if length < min || length > max {
		return NewBadRequestError(fmt.Sprintf("%s length must be between %d and %d characters", fieldName, min, max), nil)
	}
	return nil
}
