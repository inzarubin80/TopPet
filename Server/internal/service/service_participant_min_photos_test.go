package service

import (
	"context"
	"errors"
	"testing"

	"toppet/server/internal/model"
)

type minPhotosRepoStub struct {
	*mockRepository
	nomCount int64
	nomMin   int
	photoLen int
}

func (m *minPhotosRepoStub) CountNominationsByContest(ctx context.Context, contestID model.ContestID) (int64, error) {
	return m.nomCount, nil
}

func (m *minPhotosRepoStub) GetNominationByContest(ctx context.Context, contestID model.ContestID, nominationID string) (*model.Nomination, error) {
	return &model.Nomination{ID: nominationID, ContestID: contestID, MinPhotoCount: m.nomMin}, nil
}

func (m *minPhotosRepoStub) GetPhotosByParticipantID(ctx context.Context, participantID model.ParticipantID) ([]*model.Photo, error) {
	out := make([]*model.Photo, m.photoLen)
	for i := 0; i < m.photoLen; i++ {
		out[i] = &model.Photo{ID: "p"}
	}
	return out, nil
}

func TestEnsureParticipantPhotoCountAtLeastMin(t *testing.T) {
	t.Parallel()
	nom := "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	p := &model.Participant{
		ID:            "pppppppp-pppp-pppp-pppp-pppppppppppp",
		ContestID:     "cccccccc-cccc-cccc-cccc-cccccccccccc",
		NominationID:  &nom,
	}

	t.Run("no nominations requires one photo", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{mockRepository: &mockRepository{}, nomCount: 0, photoLen: 0},
		}
		err := svc.ensureParticipantPhotoCountAtLeastMin(context.Background(), p)
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})

	t.Run("no nominations one photo ok", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{mockRepository: &mockRepository{}, nomCount: 0, photoLen: 1},
		}
		if err := svc.ensureParticipantPhotoCountAtLeastMin(context.Background(), p); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("nomination min 3 with 2 photos fails", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{mockRepository: &mockRepository{}, nomCount: 1, nomMin: 3, photoLen: 2},
		}
		err := svc.ensureParticipantPhotoCountAtLeastMin(context.Background(), p)
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})

	t.Run("nomination min 3 with 3 photos ok", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{mockRepository: &mockRepository{}, nomCount: 1, nomMin: 3, photoLen: 3},
		}
		if err := svc.ensureParticipantPhotoCountAtLeastMin(context.Background(), p); err != nil {
			t.Fatal(err)
		}
	})
}
