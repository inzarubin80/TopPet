import type { Contest, ContestStatus } from '../types/models';

function parseUtcIso(s: string | undefined): Date | null {
  if (!s?.trim()) {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Эффективная фаза конкурса по датам расписания — как на сервере `ExpectedContestStatusAt`. */
export function getEffectiveContestStatus(c: Contest, now: Date = new Date()): ContestStatus {
  const hasSchedule = !!(
    c.publication_starts_at ||
    c.registration_starts_at ||
    c.voting_starts_at ||
    c.voting_ends_at
  );
  if (!hasSchedule) {
    return c.status;
  }
  const t = now.getTime();
  const ve = parseUtcIso(c.voting_ends_at);
  if (ve !== null && t >= ve.getTime()) {
    return 'finished';
  }
  const vs = parseUtcIso(c.voting_starts_at);
  if (vs !== null && t >= vs.getTime()) {
    return 'voting';
  }
  const rs = parseUtcIso(c.registration_starts_at);
  if (rs !== null && t >= rs.getTime()) {
    return 'registration';
  }
  const ps = parseUtcIso(c.publication_starts_at);
  if (ps !== null && t >= ps.getTime()) {
    return 'publication';
  }
  return 'draft';
}
