import { Contest, User, UserID, UserRole } from '../types/models';

/** Глобальные роли: полные права организатора по любому конкурсу (как contest_admin, так и system_admin). */
export function isGlobalContestManagerRole(role: UserRole | undefined): boolean {
  return role === 'system_admin' || role === 'contest_admin';
}

/** Может создавать новые конкурсы (глобальные роли). */
export function canCreateContests(user: Pick<User, 'role'> | null | undefined): boolean {
  return isGlobalContestManagerRole(user?.role);
}

/** Создатель конкурса или глобальные роли contest_admin / system_admin. */
export function userCanManageContest(
  contest: Contest,
  userId: UserID | undefined,
  user?: Pick<User, 'id' | 'role'> | null
): boolean {
  if (userId == null) {
    return false;
  }
  if (contest.created_by_user_id === userId) {
    return true;
  }
  return isGlobalContestManagerRole(user?.role);
}
