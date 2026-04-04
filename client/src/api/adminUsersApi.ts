import { axiosClient } from './axiosClient';
import { User, UserID, UserRole } from '../types/models';

export interface AdminUsersListResponse {
  items: User[];
  total: number;
}

export const listAdminUsers = async (limit = 50, offset = 0): Promise<AdminUsersListResponse> => {
  const response = await axiosClient.get<AdminUsersListResponse>('/admin/users', {
    params: { limit, offset },
  });
  return response.data;
};

export const updateAdminUserRole = async (userId: UserID, role: UserRole): Promise<User> => {
  const response = await axiosClient.patch<User>(`/admin/users/${userId}`, { role });
  return response.data;
};
