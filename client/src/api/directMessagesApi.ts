import { axiosClient } from './axiosClient';
import { DirectConversation, DirectConversationID, DirectMessage } from '../types/models';
import { DirectConversationsListResponse, DirectMessagesListResponse } from '../types/api';

export const listDirectConversations = async (limit = 50, offset = 0): Promise<DirectConversationsListResponse> => {
  const response = await axiosClient.get<DirectConversationsListResponse>('/me/dm/conversations', {
    params: { limit, offset },
  });
  return response.data;
};

export const ensureDirectConversation = async (userId: number): Promise<DirectConversation> => {
  const response = await axiosClient.post<DirectConversation>('/me/dm/conversations', { user_id: userId });
  return response.data;
};

export const deleteDirectConversation = async (conversationId: DirectConversationID): Promise<void> => {
  await axiosClient.delete(`/me/dm/${conversationId}`);
};

export const markDirectConversationRead = async (conversationId: DirectConversationID): Promise<void> => {
  await axiosClient.post(`/me/dm/${conversationId}/read`);
};

export const listDirectMessages = async (
  conversationId: DirectConversationID,
  limit = 50,
  offset = 0
): Promise<DirectMessagesListResponse> => {
  const response = await axiosClient.get<DirectMessagesListResponse>(`/me/dm/${conversationId}/messages`, {
    params: { limit, offset },
  });
  return response.data;
};

export const sendDirectMessage = async (
  conversationId: DirectConversationID,
  text: string
): Promise<DirectMessage> => {
  const response = await axiosClient.post<DirectMessage>(`/me/dm/${conversationId}/messages`, { text });
  return response.data;
};

export const updateDirectMessage = async (
  conversationId: DirectConversationID,
  messageId: string,
  text: string
): Promise<DirectMessage> => {
  const response = await axiosClient.patch<DirectMessage>(`/me/dm/${conversationId}/messages/${messageId}`, { text });
  return response.data;
};

export const deleteDirectMessage = async (
  conversationId: DirectConversationID,
  messageId: string
): Promise<void> => {
  await axiosClient.delete(`/me/dm/${conversationId}/messages/${messageId}`);
};
