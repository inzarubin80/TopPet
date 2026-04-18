import type {
  ParticipantsListNominationFilter,
  ParticipantsListSort,
  ParticipantsListSubmissionFilter,
} from '../api/participantsApi';

export type ParticipantGalleryNavigationState = {
  contestId: string;
  nominationFilter: ParticipantsListNominationFilter;
  submissionFilter: ParticipantsListSubmissionFilter;
  juryUnscoredOnly: boolean;
  votedOnly: boolean;
  /** Список на сервере отфильтрован по избранному — навигация предыдущая/следующая отключена на странице участника. */
  favoritesOnly?: boolean;
  sort: ParticipantsListSort;
  page: number;
  pageSize: number;
  total: number;
};
