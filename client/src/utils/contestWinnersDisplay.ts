import type { ContestWinnerBrief, Nomination } from '../types/models';

const tailNoNominationOrder = 1 << 30;

function winnerNominationSortKey(w: ContestWinnerBrief, sortById: Map<string, number>): number {
  const id = w.nomination_id;
  if (!id) return tailNoNominationOrder;
  const o = sortById.get(id);
  if (o === undefined) return tailNoNominationOrder - 1;
  return o;
}

/**
 * Порядок карточек победителей как у номинаций в настройках (sort_order).
 * Без номинации — в конце; при пустом списке номинаций массив не меняется.
 */
export function sortContestWinnersByNominationOrder(
  winners: ContestWinnerBrief[],
  nominations: Nomination[] | undefined
): ContestWinnerBrief[] {
  if (!nominations?.length || winners.length <= 1) {
    return winners;
  }
  const sortById = new Map(nominations.map((n) => [n.id, n.sort_order]));
  return [...winners].sort((a, b) => {
    const ka = winnerNominationSortKey(a, sortById);
    const kb = winnerNominationSortKey(b, sortById);
    if (ka !== kb) return ka - kb;
    return a.participant_id.localeCompare(b.participant_id);
  });
}

/** Склонение для русского: 1, 2–4 (кроме 12–14), 5+. */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  }
  return many;
}

export function formatVotesWord(n: number): string {
  return pluralRu(n, 'голос', 'голоса', 'голосов');
}

export function formatJuryPointsWord(n: number): string {
  return pluralRu(n, 'балл', 'балла', 'баллов');
}

export function splitContestWinnerLines(w: ContestWinnerBrief): { name: string; nomination: string | null } {
  const name = (w.pet_name || '').trim() || 'Участник';
  const nom = (w.nomination_title || '').trim();
  return { name, nomination: nom || null };
}

/** Первая буква клички для аватара-заглушки. */
export function winnerInitialsFromName(name: string): string {
  const t = name.trim();
  if (!t) {
    return '?';
  }
  const ch = t[0];
  return ch.toLocaleUpperCase('ru-RU');
}
