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

export type PatchAdminUserBody = {
  role?: UserRole;
  blocked?: boolean;
};

/** Смена роли и/или блокировки (system_admin). */
export const patchAdminUser = async (
  userId: UserID,
  body: PatchAdminUserBody
): Promise<User> => {
  const response = await axiosClient.patch<User>(`/admin/users/${userId}`, body);
  return response.data;
};

export const updateAdminUserRole = async (userId: UserID, role: UserRole): Promise<User> => {
  return patchAdminUser(userId, { role });
};
