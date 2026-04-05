import { axiosClient } from './axiosClient';
import {
  ContestID,
  ParticipantID,
  JuryScore,
  JuryScoreReportItem,
  JuryVotingProgressRow,
} from '../types/models';

export type JuryScorePutItem = { criterion_id: string; score: number };

export type JuryScoresReportResponse = {
  items: JuryScoreReportItem[];
  total_jury_score: number;
};

export type JuryVotingProgressResponse = {
  rows: JuryVotingProgressRow[];
  criteria_total: number;
  jury_member_count: number;
};

export const getJuryVotingProgress = async (contestId: ContestID): Promise<JuryVotingProgressResponse> => {
  const res = await axiosClient.get<JuryVotingProgressResponse>(
    `/contests/${contestId}/jury-voting-progress`
  );
  return {
    rows: res.data.rows || [],
    criteria_total: res.data.criteria_total ?? 0,
    jury_member_count: res.data.jury_member_count ?? 0,
  };
};

export const getJuryScoresReport = async (
  contestId: ContestID,
  participantId: ParticipantID
): Promise<JuryScoresReportResponse> => {
  const res = await axiosClient.get<JuryScoresReportResponse>(
    `/contests/${contestId}/participants/${participantId}/jury-scores-report`
  );
  return {
    items: res.data.items || [],
    total_jury_score: res.data.total_jury_score ?? 0,
  };
};

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
