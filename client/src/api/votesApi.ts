import { axiosClient } from './axiosClient';
import { ContestID, UserVoteItem, UserVotesListResponse, VoteResponse } from '../types/models';
import { VoteRequest } from '../types/api';

export const getVotes = async (contestId: ContestID): Promise<UserVoteItem[]> => {
  try {
    const response = await axiosClient.get<UserVotesListResponse>(`/contests/${contestId}/vote`);
    const votes = response.data?.votes ?? [];
    // #region agent log
    fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3c4b1'},body:JSON.stringify({sessionId:'d3c4b1',runId:'run1',hypothesisId:'H1',location:'client/src/api/votesApi.ts:getVotes',message:'Fetched votes list',data:{contestId,count:votes.length,participantIds:votes.map((v)=>v.participant_id)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return votes;
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

export const unvote = async (contestId: ContestID, participantId: string): Promise<VoteResponse | null> => {
  try {
    const params = { participant_id: participantId };
    const response = await axiosClient.delete<VoteResponse>(`/contests/${contestId}/vote`, { params });
    // #region agent log
    fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3c4b1'},body:JSON.stringify({sessionId:'d3c4b1',runId:'run1',hypothesisId:'H2',location:'client/src/api/votesApi.ts:unvote',message:'Unvote HTTP response',data:{contestId,participantId,status:'success',responseParticipantId:response.data?.participant_id??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return response.data;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 204) {
      // #region agent log
      fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3c4b1'},body:JSON.stringify({sessionId:'d3c4b1',runId:'run1',hypothesisId:'H2',location:'client/src/api/votesApi.ts:unvote',message:'Unvote HTTP 204',data:{contestId,participantId,statusCode:204},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return null;
    }
    throw error;
  }
};
