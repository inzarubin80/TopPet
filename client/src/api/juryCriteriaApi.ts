import { axiosClient } from './axiosClient';
import { ContestID, JuryCriterion } from '../types/models';

export type JuryCriterionInput = {
  title: string;
  description?: string;
  scale_min: number;
  scale_max: number;
  scale_step: number;
};

export const listJuryCriteria = async (contestId: ContestID): Promise<JuryCriterion[]> => {
  const res = await axiosClient.get<{ items: JuryCriterion[] }>(
    `/contests/${contestId}/jury-criteria`
  );
  return res.data.items || [];
};

export const replaceJuryCriteria = async (
  contestId: ContestID,
  items: JuryCriterionInput[]
): Promise<JuryCriterion[]> => {
  const res = await axiosClient.put<{ items: JuryCriterion[] }>(
    `/contests/${contestId}/jury-criteria`,
    { items }
  );
  return res.data.items || [];
};
