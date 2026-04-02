import { axiosClient } from './axiosClient';
import { ContestID, JuryMember, UserID } from '../types/models';

export const getContestJury = async (contestId: ContestID): Promise<JuryMember[]> => {
  const response = await axiosClient.get<{ items: JuryMember[] }>(`/contests/${contestId}/jury`);
  return response.data.items || [];
};

export const addJuryMember = async (
  contestId: ContestID,
  userId: UserID
): Promise<JuryMember> => {
  const response = await axiosClient.post<JuryMember>(`/contests/${contestId}/jury`, {
    user_id: userId,
  });
  return response.data;
};

export const removeJuryMember = async (
  contestId: ContestID,
  userId: UserID
): Promise<void> => {
  await axiosClient.delete(`/contests/${contestId}/jury/${userId}`);
};
