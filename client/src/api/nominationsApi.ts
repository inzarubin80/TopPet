import { axiosClient } from './axiosClient';
import { ContestID, Nomination } from '../types/models';

export const listNominations = async (contestId: ContestID): Promise<Nomination[]> => {
  const res = await axiosClient.get<{ items: Nomination[] }>(`/contests/${contestId}/nominations`);
  return res.data.items || [];
};

export const createNomination = async (
  contestId: ContestID,
  body: { title: string; description?: string }
): Promise<Nomination> => {
  const res = await axiosClient.post<Nomination>(`/contests/${contestId}/nominations`, body);
  return res.data;
};

export const updateNomination = async (
  contestId: ContestID,
  nominationId: string,
  body: { title: string; description?: string }
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
