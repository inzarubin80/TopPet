package legal

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"strings"
)

const (
	IDPrivacy = "privacy"
	IDTerms   = "terms"
)

//go:embed embed/manifest.json embed/*.md
var embeddedFS embed.FS

// ManifestEntry описывает один юридический документ в manifest.json.
type ManifestEntry struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Version string `json:"version"`
	File    string `json:"file"`
}

// Document полный документ с телом Markdown.
type Document struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Version string `json:"version"`
	Content string `json:"content"`
}

// DocumentSummary метаданные без тела (список).
type DocumentSummary struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Version string `json:"version"`
}

// Store загруженные из embed документы.
type Store struct {
	byID map[string]Document
}

// Load читает manifest и файлы .md из embed.
func Load() (*Store, error) {
	raw, err := embeddedFS.ReadFile("embed/manifest.json")
	if err != nil {
		return nil, fmt.Errorf("legal: read manifest: %w", err)
	}
	var entries []ManifestEntry
	if err := json.Unmarshal(raw, &entries); err != nil {
		return nil, fmt.Errorf("legal: parse manifest: %w", err)
	}
	byID := make(map[string]Document, len(entries))
	for _, e := range entries {
		id := strings.TrimSpace(e.ID)
		if id == "" {
			return nil, fmt.Errorf("legal: manifest entry with empty id")
		}
		path := "embed/" + strings.TrimSpace(e.File)
		body, err := embeddedFS.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("legal: read %s: %w", path, err)
		}
		byID[id] = Document{
			ID:      id,
			Title:   strings.TrimSpace(e.Title),
			Version: strings.TrimSpace(e.Version),
			Content: string(body),
		}
	}
	return &Store{byID: byID}, nil
}

// List возвращает метаданные всех документов (порядок как в manifest).
func (s *Store) List() []DocumentSummary {
	raw, _ := embeddedFS.ReadFile("embed/manifest.json")
	var entries []ManifestEntry
	_ = json.Unmarshal(raw, &entries)
	out := make([]DocumentSummary, 0, len(entries))
	for _, e := range entries {
		id := strings.TrimSpace(e.ID)
		if d, ok := s.byID[id]; ok {
			out = append(out, DocumentSummary{ID: d.ID, Title: d.Title, Version: d.Version})
		}
	}
	return out
}

// Get возвращает документ по id.
func (s *Store) Get(id string) (Document, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Document{}, fs.ErrNotExist
	}
	d, ok := s.byID[id]
	if !ok {
		return Document{}, fs.ErrNotExist
	}
	return d, nil
}

// Version возвращает строку версии для документа id (для проверки при создании заявки).
func (s *Store) Version(id string) (string, error) {
	d, err := s.Get(id)
	if err != nil {
		return "", err
	}
	if d.Version == "" {
		return "", fmt.Errorf("legal: empty version for %s", id)
	}
	return d.Version, nil
}
