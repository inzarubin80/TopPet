import { axiosClient } from './axiosClient';
import { Participant, Photo, Video, ParticipantID, ContestID } from '../types/models';
import { CreateParticipantRequest, UpdateParticipantRequest } from '../types/api';
import type { VoterInfo } from '../types/api';

export const getParticipant = async (
  contestId: ContestID,
  participantId: ParticipantID
): Promise<Participant> => {
  const response = await axiosClient.get<Participant>(
    `/contests/${contestId}/participants/${participantId}`
  );
  return response.data;
};

export const getParticipantsByContest = async (contestId: ContestID): Promise<Participant[]> => {
  const response = await axiosClient.get<{ items: Participant[]; total: number }>(
    `/contests/${contestId}/participants`
  );
  return response.data.items || [];
};

export const getParticipantVoters = async (
  contestId: ContestID,
  participantId: ParticipantID
): Promise<{ voters: VoterInfo[] }> => {
  const response = await axiosClient.get<{ voters: VoterInfo[] }>(
    `/contests/${contestId}/participants/${participantId}/voters`
  );
  return response.data;
};

export const createParticipant = async (
  contestId: ContestID,
  data: CreateParticipantRequest
): Promise<Participant> => {
  const response = await axiosClient.post<Participant>(`/contests/${contestId}/participants`, data);
  return response.data;
};

export const uploadPhoto = async (participantId: ParticipantID, file: File): Promise<Photo> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.post<Photo>(`/participants/${participantId}/photos`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 300000, // 5 минут для загрузки фото
  });
  return response.data;
};

export const uploadVideo = async (participantId: ParticipantID, file: File): Promise<Video> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.post<Video>(`/participants/${participantId}/video`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 600000, // 10 минут для загрузки больших видео файлов
  });
  return response.data;
};

export const updateParticipant = async (
  participantId: ParticipantID,
  data: UpdateParticipantRequest
): Promise<Participant> => {
  const response = await axiosClient.patch<Participant>(`/participants/${participantId}`, data);
  return response.data;
};

export const deleteParticipant = async (participantId: ParticipantID): Promise<void> => {
  await axiosClient.delete(`/participants/${participantId}`);
};

export const deletePhoto = async (participantId: ParticipantID, photoId: string): Promise<void> => {
  await axiosClient.delete(`/participants/${participantId}/photos/${photoId}`);
};

export const deleteVideo = async (participantId: ParticipantID): Promise<void> => {
  await axiosClient.delete(`/participants/${participantId}/video`);
};

export const updatePhotoOrder = async (participantId: ParticipantID, photoIds: string[]): Promise<void> => {
  await axiosClient.patch(`/participants/${participantId}/photos/order`, {
    photo_ids: photoIds,
  });
};
