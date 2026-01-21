import { axiosClient } from './axiosClient';
import { Comment, ParticipantID, CommentID } from '../types/models';
import { CreateCommentRequest, UpdateCommentRequest, CommentsListResponse } from '../types/api';

export const getComments = async (
  participantId: ParticipantID,
  limit?: number,
  offset?: number
): Promise<CommentsListResponse> => {
  const params: any = {};
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;

  const response = await axiosClient.get<CommentsListResponse>(
    `/participants/${participantId}/comments`,
    { params }
  );
  return response.data;
};

export const createComment = async (
  participantId: ParticipantID,
  data: CreateCommentRequest
): Promise<Comment> => {
  const response = await axiosClient.post<Comment>(`/participants/${participantId}/comments`, data);
  return response.data;
};

export const updateComment = async (
  commentId: CommentID,
  data: UpdateCommentRequest
): Promise<Comment> => {
  const response = await axiosClient.patch<Comment>(`/comments/${commentId}`, data);
  return response.data;
};

export const deleteComment = async (commentId: CommentID): Promise<void> => {
  await axiosClient.delete(`/comments/${commentId}`);
};
