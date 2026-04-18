import { useMemo } from 'react';
import { Participant, UserID, ContestStatus } from '../types/models';
import { userIdsEqual } from '../utils/userId';

interface UseParticipantPermissionsResult {
  isOwner: boolean;
  canEdit: boolean;
  canVote: boolean;
}

/**
 * Hook to determine user permissions for a participant.
 * canVote — можно ставить лайк (этап приёма/голосования и принятая заявка); не зависит от public_voting_enabled.
 */
export const useParticipantPermissions = (
  participant: Participant | null | undefined,
  currentUserId: UserID | undefined,
  contestStatus: ContestStatus
): UseParticipantPermissionsResult => {
  return useMemo(() => {
    if (!participant || currentUserId == null) {
      return {
        isOwner: false,
        canEdit: false,
        canVote: false,
      };
    }

    const isOwner = userIdsEqual(participant.user_id, currentUserId);
    const canEdit = isOwner && (contestStatus === 'draft' || contestStatus === 'registration');
    const submissionOk =
      !participant.submission_status || participant.submission_status === 'accepted';
    const phaseAllowsPublicLikes =
      contestStatus === 'registration' || contestStatus === 'voting';
    const canVote = phaseAllowsPublicLikes && submissionOk;

    return {
      isOwner,
      canEdit,
      canVote,
    };
  }, [participant, currentUserId, contestStatus]);
};
