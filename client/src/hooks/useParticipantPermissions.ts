import { useMemo } from 'react';
import { Participant, UserID, ContestStatus } from '../types/models';

interface UseParticipantPermissionsResult {
  isOwner: boolean;
  canEdit: boolean;
  canVote: boolean;
}

/**
 * Hook to determine user permissions for a participant
 */
export const useParticipantPermissions = (
  participant: Participant | null | undefined,
  currentUserId: UserID | undefined,
  contestStatus: ContestStatus
): UseParticipantPermissionsResult => {
  return useMemo(() => {
    if (!participant || !currentUserId) {
      return {
        isOwner: false,
        canEdit: false,
        canVote: false,
      };
    }

    const isOwner = participant.user_id === currentUserId;
    const canEdit = isOwner && (contestStatus === 'draft' || contestStatus === 'registration');
    const canVote = contestStatus === 'voting' && !isOwner;

    return {
      isOwner,
      canEdit,
      canVote,
    };
  }, [participant, currentUserId, contestStatus]);
};
