import { axiosClient } from './axiosClient';
import { VoteResponse, ContestID } from '../types/models';
import { VoteRequest } from '../types/api';

export const getVote = async (contestId: ContestID): Promise<VoteResponse | null> => {
  try {
    const response = await axiosClient.get<VoteResponse>(`/contests/${contestId}/vote`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 204) {
      return null;
    }
    throw error;
  }
};

export const vote = async (contestId: ContestID, data: VoteRequest): Promise<VoteResponse> => {
  const response = await axiosClient.post<VoteResponse>(`/contests/${contestId}/vote`, data);
  return response.data;
};
