import { axiosClient } from './axiosClient';
import { ContestID, ChatMessageID, ChatMessage } from '../types/models';
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

export const updateChatMessage = async (messageId: ChatMessageID, text: string): Promise<ChatMessage> => {
  const response = await axiosClient.patch<ChatMessage>(`/chat/${messageId}`, { text });
  return response.data;
};

export const deleteChatMessage = async (messageId: ChatMessageID): Promise<void> => {
  await axiosClient.delete(`/chat/${messageId}`);
};
