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

export const updateCurrentUser = async (data: { name: string }): Promise<User> => {
  const response = await axiosClient.patch<User>('/auth/me', data);
  return response.data;
};
