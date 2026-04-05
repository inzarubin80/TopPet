import { axiosClient } from './axiosClient';
import { ContestID, Nomination } from '../types/models';

export const listNominations = async (contestId: ContestID): Promise<Nomination[]> => {
  const res = await axiosClient.get<{ items: Nomination[] }>(`/contests/${contestId}/nominations`);
  return res.data.items || [];
};

export const createNomination = async (
  contestId: ContestID,
  body: { title: string; description?: string; min_photo_count?: number }
): Promise<Nomination> => {
  const res = await axiosClient.post<Nomination>(`/contests/${contestId}/nominations`, body);
  return res.data;
};

export const updateNomination = async (
  contestId: ContestID,
  nominationId: string,
  body: { title: string; description?: string; min_photo_count?: number }
): Promise<Nomination> => {
  const res = await axiosClient.patch<Nomination>(
    `/contests/${contestId}/nominations/${nominationId}`,
    body
  );
  return res.data;
};

export const deleteNomination = async (contestId: ContestID, nominationId: string): Promise<void> => {
  await axiosClient.delete(`/contests/${contestId}/nominations/${nominationId}`);
};

export const uploadNominationLogo = async (
  contestId: ContestID,
  nominationId: string,
  file: File
): Promise<Nomination> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosClient.post<Nomination>(
    `/contests/${contestId}/nominations/${nominationId}/logo`,
    formData,
    { timeout: 300000 }
  );
  return res.data;
};

export const clearNominationLogo = async (
  contestId: ContestID,
  nominationId: string
): Promise<Nomination> => {
  const res = await axiosClient.delete<Nomination>(
    `/contests/${contestId}/nominations/${nominationId}/logo`
  );
  return res.data;
};
