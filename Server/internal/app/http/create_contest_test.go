package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"toppet/server/internal/app/defenitions"
	"toppet/server/internal/model"
)

// mockServiceCreateContest мок для serviceCreateContest
type mockServiceCreateContest struct {
	createContestFunc func(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
}

func (m *mockServiceCreateContest) CreateContest(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
	if m.createContestFunc != nil {
		return m.createContestFunc(ctx, userID, title, description)
	}
	return nil, nil
}

func TestCreateContestHandler_ServeHTTP(t *testing.T) {
	tests := []struct {
		name           string
		requestBody    map[string]string
		userID         model.UserID
		mockFunc       func(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error)
		expectedStatus int
	}{
		{
			name: "successful creation",
			requestBody: map[string]string{
				"title":       "Test Contest",
				"description": "Test Description",
			},
			userID: 1,
			mockFunc: func(ctx context.Context, userID model.UserID, title, description string) (*model.Contest, error) {
				return &model.Contest{
					ID:              "test-id",
					CreatedByUserID: userID,
					Title:           title,
					Description:     description,
					Status:          model.ContestStatusDraft,
				}, nil
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid json",
			requestBody:    nil, // Будем отправлять невалидный JSON
			userID:         1,
			mockFunc:       nil,
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &mockServiceCreateContest{
				createContestFunc: tt.mockFunc,
			}
			handler := NewCreateContestHandler("/api/contests", mockService)

			var body []byte
			var err error
			if tt.name == "invalid json" {
				// Отправляем невалидный JSON
				body = []byte(`{invalid json}`)
			} else if tt.requestBody != nil {
				body, err = json.Marshal(tt.requestBody)
				if err != nil {
					t.Fatalf("Failed to marshal request body: %v", err)
				}
			}

			req := httptest.NewRequest(http.MethodPost, "/api/contests", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			ctx := context.WithValue(req.Context(), defenitions.UserID, tt.userID)
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}
