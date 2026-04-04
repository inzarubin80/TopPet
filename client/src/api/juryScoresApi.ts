import { axiosClient } from './axiosClient';
import { ContestID, ParticipantID, JuryScore } from '../types/models';

export type JuryScorePutItem = { criterion_id: string; score: number };

export const getMyJuryScores = async (
  contestId: ContestID,
  participantId: ParticipantID
): Promise<JuryScore[]> => {
  const res = await axiosClient.get<{ items: JuryScore[] }>(
    `/contests/${contestId}/participants/${participantId}/my-jury-scores`
  );
  return res.data.items || [];
};

export const putMyJuryScores = async (
  contestId: ContestID,
  participantId: ParticipantID,
  items: JuryScorePutItem[]
): Promise<JuryScore[]> => {
  const res = await axiosClient.put<{ items: JuryScore[] }>(
    `/contests/${contestId}/participants/${participantId}/my-jury-scores`,
    { items }
  );
  return res.data.items || [];
};
