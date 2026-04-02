import { axiosClient } from './axiosClient';
import { UserSearchHit } from '../types/models';

export const searchUsers = async (q: string, limit = 20): Promise<UserSearchHit[]> => {
  const response = await axiosClient.get<{ items: UserSearchHit[] }>('/users/search', {
    params: { q, limit },
  });
  return response.data.items || [];
};
