import { axiosClient } from './axiosClient';
import { AuthResponse, Provider, User } from '../types/models';

export const refreshToken = async (refreshToken: string): Promise<AuthResponse> => {
  const response = await axiosClient.post<AuthResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return response.data;
};

export const getProviders = async (): Promise<Provider[]> => {
  const response = await axiosClient.get<Provider[]>('/auth/providers');
  return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await axiosClient.get<User>('/auth/me');
  return response.data;
};

export type PatchCurrentUserBody = {
  name?: string;
  email?: string;
  phone?: string;
  /** YYYY-MM-DD; пустая строка сбрасывает дату */
  date_of_birth?: string;
  avatar_url?: string;
};

export const updateCurrentUser = async (data: PatchCurrentUserBody): Promise<User> => {
  const response = await axiosClient.patch<User>('/auth/me', data);
  return response.data;
};

export const deleteCurrentUser = async (): Promise<void> => {
  await axiosClient.delete('/auth/me');
};
