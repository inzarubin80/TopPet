import { axiosClient } from './axiosClient';
import { PhotoLikeResponse } from '../types/models';

export const getPhotoLike = async (photoId: string): Promise<PhotoLikeResponse | null> => {
  try {
    const response = await axiosClient.get<PhotoLikeResponse>(`/photos/${photoId}/like`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 204 || error.response?.status === 401) {
      return null;
    }
    throw error;
  }
};

export const likePhoto = async (photoId: string): Promise<PhotoLikeResponse> => {
  const response = await axiosClient.post<PhotoLikeResponse>(`/photos/${photoId}/like`);
  return response.data;
};

export const unlikePhoto = async (photoId: string): Promise<PhotoLikeResponse | null> => {
  try {
    const response = await axiosClient.delete<PhotoLikeResponse>(`/photos/${photoId}/like`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 204) {
      return null;
    }
    throw error;
  }
};
