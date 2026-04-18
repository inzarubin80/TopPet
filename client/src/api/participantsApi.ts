import { axiosClient } from './axiosClient';
import { Participant, Photo, ParticipantID, ContestID, ParticipantSubmissionStatus } from '../types/models';
import { CreateParticipantRequest, UpdateParticipantRequest } from '../types/api';
import type { VoterInfo } from '../types/api';

/** Фильтр списка заявок: все | без номинации | id номинации */
export type ParticipantsListNominationFilter = 'all' | 'none' | string;

/** Статус заявки в списке (только для организаторов, с авторизацией) */
export type ParticipantsListSubmissionFilter =
  | 'all'
  | 'accepted'
  | 'pending'
  | 'rejected'
  | 'non_accepted';

export type ParticipantListScope = 'all' | 'mine';

/** Порядок списка заявок (query `sort`): лайки, жюри, дата, комментарии */
export type ParticipantsListSort = 'votes' | 'jury' | 'created_at' | 'comments';

export type GetParticipantsByContestOptions = {
  limit?: number;
  offset?: number;
  participantScope?: ParticipantListScope;
  submissionFilter?: ParticipantsListSubmissionFilter;
  /** Только участники с отметкой «Мне нравится» у текущего пользователя (нужна авторизация) */
  votedOnly?: boolean;
  /** Сортировка: голоса, жюри, дата подачи (новые сверху) или число комментариев */
  sort?: ParticipantsListSort;
};

export type ParticipantsListResponse = {
  items: Participant[];
  total: number;
  limit: number;
  offset: number;
};

export const getParticipant = async (
  contestId: ContestID,
  participantId: ParticipantID
): Promise<Participant> => {
  const response = await axiosClient.get<Participant>(
    `/contests/${contestId}/participants/${participantId}`
  );
  return response.data;
};

export const getParticipantsByContest = async (
  contestId: ContestID,
  nominationFilter: ParticipantsListNominationFilter = 'all',
  options?: GetParticipantsByContestOptions
): Promise<ParticipantsListResponse> => {
  const params = new URLSearchParams();
  if (nominationFilter === 'none') {
    params.set('nomination_id', 'none');
  } else if (nominationFilter !== 'all') {
    params.set('nomination_id', nominationFilter);
  }
  if (options?.participantScope === 'mine') {
    params.set('participant_scope', 'mine');
  }
  if (options?.limit != null) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset != null) {
    params.set('offset', String(options.offset));
  }
  if (options?.submissionFilter && options.submissionFilter !== 'all') {
    params.set('submission_filter', options.submissionFilter);
  }
  if (options?.votedOnly) {
    params.set('voted_only', '1');
  }
  if (options?.sort) {
    params.set('sort', options.sort);
  }
  const qs = params.toString();
  const response = await axiosClient.get<ParticipantsListResponse>(
    `/contests/${contestId}/participants${qs ? `?${qs}` : ''}`
  );
  const data = response.data;
  return {
    items: data.items || [],
    total: data.total ?? 0,
    limit: data.limit ?? 10000,
    offset: data.offset ?? 0,
  };
};

export const getParticipantVoters = async (
  contestId: ContestID,
  participantId: ParticipantID
): Promise<{ voters: VoterInfo[] }> => {
  const response = await axiosClient.get<{ voters: VoterInfo[] }>(
    `/contests/${contestId}/participants/${participantId}/voters`
  );
  return response.data;
};

export const createParticipant = async (
  contestId: ContestID,
  data: CreateParticipantRequest
): Promise<Participant> => {
  const response = await axiosClient.post<Participant>(`/contests/${contestId}/participants`, data);
  return response.data;
};

export const uploadPhoto = async (participantId: ParticipantID, file: File): Promise<Photo> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.post<Photo>(`/participants/${participantId}/photos`, formData, {
    timeout: 300000, // 5 минут для загрузки фото
  });
  return response.data;
};

export const updateParticipant = async (
  participantId: ParticipantID,
  data: UpdateParticipantRequest
): Promise<Participant> => {
  const response = await axiosClient.patch<Participant>(`/participants/${participantId}`, data);
  return response.data;
};

export const patchParticipantSubmission = async (
  participantId: ParticipantID,
  submission_status: ParticipantSubmissionStatus,
  submission_comment?: string
): Promise<Participant> => {
  const body: {
    submission_status: ParticipantSubmissionStatus;
    submission_comment?: string;
  } = { submission_status };
  if (submission_status === 'rejected' && submission_comment !== undefined) {
    body.submission_comment = submission_comment;
  }
  const response = await axiosClient.patch<Participant>(`/participants/${participantId}/submission`, body);
  return response.data;
};

export const deleteParticipant = async (participantId: ParticipantID): Promise<void> => {
  await axiosClient.delete(`/participants/${participantId}`);
};

export const deletePhoto = async (participantId: ParticipantID, photoId: string): Promise<void> => {
  await axiosClient.delete(`/participants/${participantId}/photos/${photoId}`);
};

export const putParticipantFavorite = async (
  contestId: ContestID,
  participantId: ParticipantID,
  favorite: boolean
): Promise<void> => {
  await axiosClient.put(`/contests/${contestId}/participants/${participantId}/favorite`, { favorite });
};

export const updatePhotoOrder = async (participantId: ParticipantID, photoIds: string[]): Promise<void> => {
  await axiosClient.patch(`/participants/${participantId}/photos/order`, {
    photo_ids: photoIds,
  });
};
