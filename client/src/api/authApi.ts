import { axiosClient } from './axiosClient';
import { AuthResponse, Provider } from '../types/models';

export const devLogin = async (name: string): Promise<AuthResponse> => {
  const response = await axiosClient.post<AuthResponse>('/auth/dev-login', { name });
  return response.data;
};

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
