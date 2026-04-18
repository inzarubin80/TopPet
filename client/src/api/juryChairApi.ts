import { axiosClient } from './axiosClient';
import type { ContestID, JuryChairboardData, ParticipantID } from '../types/models';
import type { ParticipantsListNominationFilter } from './participantsApi';

export type JuryChairAssignmentInput = {
  participant_id: ParticipantID;
  place?: number;
  prize?: string;
};

export const getJuryChairboard = async (
  contestId: ContestID,
  nominationFilter: ParticipantsListNominationFilter = 'all'
): Promise<JuryChairboardData> => {
  const params = new URLSearchParams();
  if (nominationFilter === 'none') {
    params.set('nomination_id', 'none');
  } else if (nominationFilter !== 'all') {
    params.set('nomination_id', nominationFilter);
  }
  const qs = params.toString();
  const url =
    qs === ''
      ? `/contests/${contestId}/jury-chairboard`
      : `/contests/${contestId}/jury-chairboard?${qs}`;
  const res = await axiosClient.get<JuryChairboardData>(url);
  return res.data;
};

export const putJuryChairAssignments = async (
  contestId: ContestID,
  assignments: JuryChairAssignmentInput[]
): Promise<{ contest_id: string; updated_at: string }> => {
  const res = await axiosClient.put<{ contest_id: string; updated_at: string }>(
    `/contests/${contestId}/jury-chair-assignments`,
    { assignments }
  );
  return res.data;
};
