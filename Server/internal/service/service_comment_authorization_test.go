package service

import (
	"context"
	"errors"
	"testing"

	"toppet/server/internal/model"
)

func TestUpdateComment_NonAuthorGetsForbidden(t *testing.T) {
	cid := model.ContestID("cccccccc-cccc-cccc-cccc-cccccccccccc")
	pid := model.ParticipantID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	commentID := model.CommentID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

	svc := &TopPetService{
		repository: &mockRepository{
			getCommentFunc: func(ctx context.Context, id model.CommentID) (*model.Comment, error) {
				if id != commentID {
					return nil, model.ErrorNotFound
				}
				return &model.Comment{
					ID:            commentID,
					ParticipantID: pid,
					UserID:        10,
					Text:          "orig",
				}, nil
			},
			getParticipantFunc: func(ctx context.Context, id model.ParticipantID) (*model.Participant, error) {
				if id != pid {
					return nil, model.ErrorNotFound
				}
				return &model.Participant{
					ID:        pid,
					ContestID: cid,
				}, nil
			},
			getContestFunc: func(ctx context.Context, id model.ContestID) (*model.Contest, error) {
				if id != cid {
					return nil, model.ErrorNotFound
				}
				return &model.Contest{
					ID:              cid,
					CreatedByUserID: 1,
					Title:           "t",
					Description:     "d",
					Status:          model.ContestStatusRegistration,
					MinPhotoCount:   1,
					MaxPhotoCount:   10,
				}, nil
			},
		},
	}

	_, err := svc.UpdateComment(context.Background(), commentID, 99, "hijack")
	if !errors.Is(err, model.ErrForbidden) {
		t.Fatalf("UpdateComment: want ErrForbidden, got %v", err)
	}
}
