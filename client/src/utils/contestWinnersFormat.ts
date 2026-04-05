import type { ContestWinnerBrief } from '../types/models';

/** Строка списка победителя: кличка и номинация. */
export function formatContestWinnerLine(w: ContestWinnerBrief): string {
  const name = (w.pet_name || '').trim() || 'Участник';
  const nom = (w.nomination_title || '').trim();
  const suffix = nom ? ` (${nom})` : '';
  return `${name}${suffix}`;
}
