import { Contest, User, UserID } from '../types/models';

/** Может создавать новые конкурсы (глобальные роли). */
export function canCreateContests(user: Pick<User, 'role'> | null | undefined): boolean {
  const r = user?.role ?? 'user';
  return r === 'system_admin' || r === 'contest_admin';
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
  const r = user?.role ?? 'user';
  return r === 'contest_admin' || r === 'system_admin';
}
