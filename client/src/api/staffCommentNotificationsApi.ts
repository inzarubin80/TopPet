import { axiosClient } from './axiosClient';
import { StaffCommentNotification } from '../types/models';

export interface StaffCommentNotificationsResponse {
  items: StaffCommentNotification[];
  total_unread: number;
}

export const getStaffCommentNotifications = async (): Promise<StaffCommentNotificationsResponse> => {
  const response = await axiosClient.get<StaffCommentNotificationsResponse>('/me/staff-comment-notifications');
  return response.data;
};
