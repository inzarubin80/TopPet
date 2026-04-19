package service

import "strings"

const notificationPreviewMaxRunes = 120

func notificationMessagePreview(text, imageURL string) string {
	t := strings.TrimSpace(text)
	if t != "" {
		runes := []rune(t)
		if len(runes) > notificationPreviewMaxRunes {
			return string(runes[:notificationPreviewMaxRunes]) + "…"
		}
		return t
	}
	if strings.TrimSpace(imageURL) != "" {
		return "Изображение"
	}
	return ""
}
