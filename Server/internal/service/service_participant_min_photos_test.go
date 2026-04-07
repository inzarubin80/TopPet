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
	contest  *model.Contest
	photoLen int
}

func (m *minPhotosRepoStub) CountNominationsByContest(ctx context.Context, contestID model.ContestID) (int64, error) {
	return m.nomCount, nil
}

func (m *minPhotosRepoStub) GetContest(ctx context.Context, contestID model.ContestID) (*model.Contest, error) {
	if m.contest != nil {
		return m.contest, nil
	}
	return &model.Contest{
		ID:            contestID,
		MinPhotoCount: 1,
		MaxPhotoCount: 30,
	}, nil
}

func (m *minPhotosRepoStub) GetPhotosByParticipantID(ctx context.Context, participantID model.ParticipantID) ([]*model.Photo, error) {
	out := make([]*model.Photo, m.photoLen)
	for i := 0; i < m.photoLen; i++ {
		out[i] = &model.Photo{ID: "p"}
	}
	return out, nil
}

func TestEnsureParticipantPhotoCountInBounds(t *testing.T) {
	t.Parallel()
	nom := "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	cid := model.ContestID("cccccccc-cccc-cccc-cccc-cccccccccccc")
	p := &model.Participant{
		ID:            "pppppppp-pppp-pppp-pppp-pppppppppppp",
		ContestID:     cid,
		NominationID:  &nom,
	}

	t.Run("no nominations requires one photo", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{mockRepository: &mockRepository{}, nomCount: 0, photoLen: 0},
		}
		err := svc.ensureParticipantPhotoCountInBounds(context.Background(), p)
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})

	t.Run("no nominations one photo ok", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{mockRepository: &mockRepository{}, nomCount: 0, photoLen: 1},
		}
		if err := svc.ensureParticipantPhotoCountInBounds(context.Background(), p); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("no nominations 31 photos fails max", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{mockRepository: &mockRepository{}, nomCount: 0, photoLen: 31},
		}
		err := svc.ensureParticipantPhotoCountInBounds(context.Background(), p)
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})

	t.Run("contest min 3 with 2 photos fails", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{
				mockRepository: &mockRepository{},
				nomCount:       1,
				contest:        &model.Contest{ID: cid, MinPhotoCount: 3, MaxPhotoCount: 10},
				photoLen:       2,
			},
		}
		err := svc.ensureParticipantPhotoCountInBounds(context.Background(), p)
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})

	t.Run("contest min 3 with 3 photos ok", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{
				mockRepository: &mockRepository{},
				nomCount:       1,
				contest:        &model.Contest{ID: cid, MinPhotoCount: 3, MaxPhotoCount: 10},
				photoLen:       3,
			},
		}
		if err := svc.ensureParticipantPhotoCountInBounds(context.Background(), p); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("contest max 5 with 6 photos fails", func(t *testing.T) {
		svc := &TopPetService{
			repository: &minPhotosRepoStub{
				mockRepository: &mockRepository{},
				nomCount:       1,
				contest:        &model.Contest{ID: cid, MinPhotoCount: 1, MaxPhotoCount: 5},
				photoLen:       6,
			},
		}
		err := svc.ensureParticipantPhotoCountInBounds(context.Background(), p)
		if err == nil || !errors.Is(err, model.ErrBadRequest) {
			t.Fatalf("expected ErrBadRequest, got %v", err)
		}
	})
}
