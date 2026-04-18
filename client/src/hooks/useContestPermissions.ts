import { useMemo } from 'react';
import { Contest, User } from '../types/models';
import { userCanManageContest } from '../utils/contestPermissions';

interface UseContestPermissionsResult {
  isAdmin: boolean;
  /** Подача и правка заявок организатором — только черновик и регистрация (как на сервере). */
  canManageParticipants: boolean;
  canVote: boolean;
  /** Настройки конкурса на странице редактирования — для организатора в любом статусе. */
  canEdit: boolean;
}

/**
 * Hook to determine user permissions for a contest
 */
export const useContestPermissions = (
  contest: Contest | null | undefined,
  currentUser: User | null | undefined
): UseContestPermissionsResult => {
  return useMemo(() => {
    if (!contest || !currentUser?.id) {
      return {
        isAdmin: false,
        canManageParticipants: false,
        canVote: false,
        canEdit: false,
      };
    }

    const currentUserId = currentUser.id;
    const isAdmin = userCanManageContest(contest, currentUserId, currentUser);
    const canManageParticipants = isAdmin && (contest.status === 'draft' || contest.status === 'registration');
    const canVote = contest.status === 'voting' || contest.status === 'registration';
    const canEdit = isAdmin;

    return {
      isAdmin,
      canManageParticipants,
      canVote,
      canEdit,
    };
  }, [contest, currentUser]);
};
