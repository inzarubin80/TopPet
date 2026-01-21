import { axiosClient } from './axiosClient';
import { Contest, ContestID, ContestStatus } from '../types/models';
import {
  ContestsListResponse,
  CreateContestRequest,
  UpdateContestRequest,
} from '../types/api';

export const getContests = async (
  status?: ContestStatus,
  limit?: number,
  offset?: number
): Promise<ContestsListResponse> => {
  const params: any = {};
  // Only include status if it's explicitly provided (not undefined)
  // When status is undefined, we want to get all contests
  if (status !== undefined && status !== null) {
    params.status = status;
  }
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;

  const response = await axiosClient.get<ContestsListResponse>('/contests', { params });
  return response.data;
};

export const getContest = async (contestId: ContestID): Promise<Contest> => {
  const response = await axiosClient.get<Contest>(`/contests/${contestId}`);
  return response.data;
};

export const createContest = async (data: CreateContestRequest): Promise<Contest> => {
  const response = await axiosClient.post<Contest>('/contests', data);
  return response.data;
};

export const updateContest = async (
  contestId: ContestID,
  data: UpdateContestRequest
): Promise<Contest> => {
  const response = await axiosClient.patch<Contest>(`/contests/${contestId}`, data);
  return response.data;
};

export const publishContest = async (contestId: ContestID): Promise<Contest> => {
  const response = await axiosClient.post<Contest>(`/contests/${contestId}/publish`);
  return response.data;
};

export const finishContest = async (contestId: ContestID): Promise<Contest> => {
  const response = await axiosClient.post<Contest>(`/contests/${contestId}/finish`);
  return response.data;
};

export const deleteContest = async (contestId: ContestID): Promise<{ ok: boolean }> => {
  const response = await axiosClient.delete<{ ok: boolean }>(`/contests/${contestId}`);
  return response.data;
};
