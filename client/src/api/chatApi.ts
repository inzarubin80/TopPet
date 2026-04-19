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

export const deleteChatMessage = async (messageId: ChatMessageID): Promise<ChatMessageID[]> => {
  const response = await axiosClient.delete<{ ok: boolean; deleted_message_ids: ChatMessageID[] }>(
    `/chat/${messageId}`
  );
  return response.data.deleted_message_ids ?? [messageId];
};

export const voteChatMessage = async (messageId: ChatMessageID, value: -1 | 1): Promise<void> => {
  await axiosClient.post(`/chat/${messageId}/vote`, { value });
};

export const uploadContestChatImage = async (contestId: ContestID, file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axiosClient.post<{ url: string }>(`/contests/${contestId}/chat/upload-image`, formData, {
    timeout: 300000,
  });
  return response.data.url;
};
