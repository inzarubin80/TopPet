import { axiosClient } from './axiosClient';
import { ContestID, UserVoteItem, UserVotesListResponse, VoteResponse } from '../types/models';
import { VoteRequest } from '../types/api';

export const getVotes = async (contestId: ContestID): Promise<UserVoteItem[]> => {
  try {
    const response = await axiosClient.get<UserVotesListResponse>(`/contests/${contestId}/vote`);
    return response.data?.votes ?? [];
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 401 || err.response?.status === 204) {
      return [];
    }
    throw error;
  }
};

export const vote = async (contestId: ContestID, data: VoteRequest): Promise<VoteResponse> => {
  const response = await axiosClient.post<VoteResponse>(`/contests/${contestId}/vote`, data);
  return response.data;
};

export const unvote = async (contestId: ContestID, nominationId?: string | null): Promise<VoteResponse | null> => {
  try {
    const params =
      nominationId !== undefined && nominationId !== null && nominationId.trim() !== ''
        ? { nomination_id: nominationId.trim() }
        : {};
    const response = await axiosClient.delete<VoteResponse>(`/contests/${contestId}/vote`, { params });
    return response.data;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 204) {
      return null;
    }
    throw error;
  }
};
