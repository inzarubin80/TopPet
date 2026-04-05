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

/** Загрузка файла для поля типа «картинка» (до создания заявки). */
export const uploadRegistrationFieldImage = async (
  contestId: ContestID,
  file: File,
  fieldId?: string
): Promise<string> => {
  const fd = new FormData();
  fd.append('file', file);
  if (fieldId) {
    fd.append('field_id', fieldId);
  }
  const res = await axiosClient.post<{ url: string }>(
    `/contests/${contestId}/registration-image-upload`,
    fd
  );
  const url = res.data?.url;
  if (!url || typeof url !== 'string') {
    throw new Error('Сервер не вернул URL изображения');
  }
  return url;
};
