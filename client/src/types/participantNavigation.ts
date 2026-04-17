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
  sort: ParticipantsListSort;
  page: number;
  pageSize: number;
  total: number;
};
