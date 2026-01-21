import { axiosClient } from './axiosClient';
import { ContestID } from '../types/models';
import { ChatMessagesListResponse } from '../types/api';

export const getChatMessages = async (
  contestId: ContestID,
  limit?: number,
  offset?: number
): Promise<ChatMessagesListResponse> => {
  const params: any = {};
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;

  const response = await axiosClient.get<ChatMessagesListResponse>(`/contests/${contestId}/chat`, {
    params,
  });
  return response.data;
};
