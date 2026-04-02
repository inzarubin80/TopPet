import { axiosClient } from './axiosClient';
import { ContestID, RegistrationField, RegistrationFieldInput } from '../types/models';

export const listRegistrationFields = async (contestId: ContestID): Promise<RegistrationField[]> => {
  const res = await axiosClient.get<{ items: RegistrationField[] }>(
    `/contests/${contestId}/registration-fields`
  );
  return res.data.items || [];
};

export const replaceRegistrationFields = async (
  contestId: ContestID,
  items: RegistrationFieldInput[]
): Promise<RegistrationField[]> => {
  const res = await axiosClient.put<{ items: RegistrationField[] }>(
    `/contests/${contestId}/registration-fields`,
    { items }
  );
  return res.data.items || [];
};
