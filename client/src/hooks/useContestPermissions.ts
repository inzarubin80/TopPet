import { useMemo } from 'react';
import { Contest, UserID } from '../types/models';

interface UseContestPermissionsResult {
  isAdmin: boolean;
  canManageParticipants: boolean;
  canVote: boolean;
  canEdit: boolean;
}

/**
 * Hook to determine user permissions for a contest
 */
export const useContestPermissions = (
  contest: Contest | null | undefined,
  currentUserId: UserID | undefined
): UseContestPermissionsResult => {
  return useMemo(() => {
    if (!contest || !currentUserId) {
      return {
        isAdmin: false,
        canManageParticipants: false,
        canVote: false,
        canEdit: false,
      };
    }

    const isAdmin = contest.created_by_user_id === currentUserId;
    const canManageParticipants = isAdmin && (contest.status === 'draft' || contest.status === 'registration');
    const canVote = contest.status === 'voting';
    const canEdit = isAdmin && (contest.status === 'draft' || contest.status === 'registration');

    return {
      isAdmin,
      canManageParticipants,
      canVote,
      canEdit,
    };
  }, [contest, currentUserId]);
};
