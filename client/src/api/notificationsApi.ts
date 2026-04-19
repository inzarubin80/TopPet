import { axiosClient } from './axiosClient';
import { NotificationsListResponse, UserNotification } from '../types/notifications';

export const fetchNotifications = async (params?: {
  limit?: number;
  cursor_created_at?: string;
  cursor_id?: string;
  signal?: AbortSignal;
}): Promise<NotificationsListResponse> => {
  const { signal, ...rest } = params ?? {};
  const response = await axiosClient.get<NotificationsListResponse>('/me/notifications', {
    params: rest,
    signal,
  });
  return response.data;
};

export const markNotificationRead = async (
  notificationId: string,
  signal?: AbortSignal
): Promise<UserNotification> => {
  const response = await axiosClient.patch<UserNotification>(
    `/me/notifications/${encodeURIComponent(notificationId)}`,
    { read: true },
    { signal }
  );
  return response.data;
};

export const markAllNotificationsRead = async (signal?: AbortSignal): Promise<void> => {
  await axiosClient.post('/me/notifications/read-all', {}, { signal });
};
