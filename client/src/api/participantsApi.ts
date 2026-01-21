import { axiosClient } from './axiosClient';
import { Participant, Photo, Video, ParticipantID, ContestID } from '../types/models';
import { CreateParticipantRequest } from '../types/api';

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
  // Note: This endpoint may need to be added to the server
  // For now, we'll use a workaround or wait for the endpoint
  const response = await axiosClient.get<Participant[]>(`/contests/${contestId}/participants`);
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
  });
  return response.data;
};
