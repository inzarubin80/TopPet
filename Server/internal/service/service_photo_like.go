package service

import (
	"context"

	"toppet/server/internal/model"
)

func (s *TopPetService) LikePhoto(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error) {
	// Check if photo exists by trying to get participant
	// We need to verify photo exists, but we don't have direct GetPhoto method
	// For now, we'll just try to like it and let DB constraints handle it
	like, err := s.repository.UpsertPhotoLike(ctx, photoID, userID)
	if err != nil {
		return nil, err
	}

	return like, nil
}

func (s *TopPetService) UnlikePhoto(ctx context.Context, photoID string, userID model.UserID) error {
	err := s.repository.DeletePhotoLike(ctx, photoID, userID)
	if err != nil {
		return err
	}
	return nil
}

func (s *TopPetService) GetPhotoLike(ctx context.Context, photoID string, userID model.UserID) (*model.PhotoLike, error) {
	like, err := s.repository.GetPhotoLikeByUser(ctx, photoID, userID)
	if err != nil {
		return nil, err
	}
	return like, nil
}

func (s *TopPetService) GetPhotoLikesCount(ctx context.Context, photoID string) (int64, error) {
	count, err := s.repository.CountPhotoLikes(ctx, photoID)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (s *TopPetService) GetUserPhotoLikes(ctx context.Context, photoIDs []string, userID model.UserID) (map[string]*model.PhotoLike, error) {
	likes, err := s.repository.ListPhotoLikesByPhotos(ctx, photoIDs, userID)
	if err != nil {
		return nil, err
	}
	return likes, nil
}
