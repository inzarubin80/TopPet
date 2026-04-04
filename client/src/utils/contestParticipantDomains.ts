/**
 * Может ли пользователь подать заявку при ограничении по доменам e-mail конкурса.
 * Организаторы конкурса (и выше) не ограничиваются.
 */
export function userMayRegisterForContest(
  userEmail: string | undefined,
  allowedDomains: string[] | undefined,
  isContestOrganizer: boolean
): boolean {
  if (isContestOrganizer) {
    return true;
  }
  const domains = (allowedDomains ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (domains.length === 0) {
    return true;
  }
  const em = (userEmail ?? '').trim().toLowerCase();
  const at = em.lastIndexOf('@');
  if (at < 0 || at === em.length - 1) {
    return false;
  }
  const host = em.slice(at + 1);
  return domains.some((dom) => host === dom || host.endsWith('.' + dom));
}
