import type { ContestWinnerBrief, Nomination, Participant } from '../types/models';

/** Ключ ведра номинации, как на сервере: пустая строка — без номинации. */
export function nominationBucketKey(nominationId?: string | null): string {
  if (!nominationId || nominationId === '') {
    return '';
  }
  return nominationId;
}

export function groupWinnersByNomination(winners: ContestWinnerBrief[] | undefined): Map<string, ContestWinnerBrief[]> {
  const m = new Map<string, ContestWinnerBrief[]>();
  if (!winners?.length) {
    return m;
  }
  for (const w of winners) {
    const k = nominationBucketKey(w.nomination_id);
    const arr = m.get(k);
    if (arr) {
      arr.push(w);
    } else {
      m.set(k, [w]);
    }
  }
  return m;
}

/**
 * Порядок строк — только по полю `place` из снимка API (`jury_winners` / `audience_winners`):
 * для жюри места задаются председателем или сохранённым расчётом; баллы не влияют на порядок.
 */
export function sortWinnersBySnapshotPlace(winners: ContestWinnerBrief[]): ContestWinnerBrief[] {
  return [...winners].sort((a, b) => {
    const pa = normalizePlaceForSort(a.place);
    const pb = normalizePlaceForSort(b.place);
    if (pa !== pb) {
      return pa - pb;
    }
    return a.participant_id.localeCompare(b.participant_id);
  });
}

/** Нет места или место ≤ 0 — в конец списка. */
function normalizePlaceForSort(place?: number): number {
  if (place === undefined || place === null || place <= 0) {
    return 1_000_000;
  }
  return place;
}

export function splitPodiumAndLaureates(sorted: ContestWinnerBrief[]): {
  podium: ContestWinnerBrief[];
  laureates: ContestWinnerBrief[];
} {
  const podium: ContestWinnerBrief[] = [];
  const laureates: ContestWinnerBrief[] = [];
  for (const w of sorted) {
    const p = w.place;
    if (p !== undefined && p !== null && p >= 1 && p <= 3) {
      podium.push(w);
    } else {
      laureates.push(w);
    }
  }
  return { podium, laureates };
}

/** Ключи номинаций, у которых есть хотя бы один победитель (жюри или зрители). */
export function nominationKeysWithWinners(
  jury: ContestWinnerBrief[] | undefined,
  audience: ContestWinnerBrief[] | undefined
): string[] {
  const set = new Set<string>();
  for (const w of jury ?? []) {
    set.add(nominationBucketKey(w.nomination_id));
  }
  for (const w of audience ?? []) {
    set.add(nominationBucketKey(w.nomination_id));
  }
  return Array.from(set);
}

/**
 * Порядок вкладок: как в настройках конкурса; ведро без номинации — в конце.
 */
export function orderNominationKeysForTabs(
  keys: string[],
  nominations: Nomination[],
  nominationTitleById: Record<string, string>
): string[] {
  const orderMap = new Map<string, number>();
  nominations.forEach((n, i) => orderMap.set(n.id, n.sort_order * 1000 + i));
  const tailEmpty = 1 << 30;
  return [...keys].sort((a, b) => {
    const oa = a === '' ? tailEmpty : orderMap.get(a) ?? tailEmpty - 1;
    const ob = b === '' ? tailEmpty : orderMap.get(b) ?? tailEmpty - 1;
    if (oa !== ob) {
      return oa - ob;
    }
    const ta = a === '' ? '\uffff' : nominationTitleById[a] ?? a;
    const tb = b === '' ? '\uffff' : nominationTitleById[b] ?? b;
    return ta.localeCompare(tb, 'ru');
  });
}

export function labelForNominationKey(
  key: string,
  nominationTitleById: Record<string, string>
): string {
  if (key === '') {
    return 'Без номинации';
  }
  return nominationTitleById[key]?.trim() || 'Номинация';
}

export function buildAudienceByParticipantId(audience: ContestWinnerBrief[] | undefined): Map<string, ContestWinnerBrief> {
  const m = new Map<string, ContestWinnerBrief>();
  for (const w of audience ?? []) {
    m.set(w.participant_id, w);
  }
  return m;
}

export function participantDisplayName(p: Participant | undefined, brief: ContestWinnerBrief): string {
  const t = (p?.entry_title || '').trim();
  if (t) {
    return t;
  }
  const bt = (brief.entry_title || '').trim();
  if (bt) {
    return bt;
  }
  const pet = (p?.pet_name || brief.pet_name || '').trim();
  return pet || 'Участник';
}

export function voteCountForParticipant(
  participantId: string,
  p: Participant | undefined,
  audienceByPid: Map<string, ContestWinnerBrief>
): number | null {
  if (p && p.total_votes !== undefined && p.total_votes !== null) {
    return p.total_votes;
  }
  const fromBrief = audienceByPid.get(participantId);
  if (fromBrief !== undefined) {
    return fromBrief.score;
  }
  return null;
}

export type PrimaryTrack = 'jury' | 'audience';

export function pickPrimaryTrack(
  juryVotingEnabled: boolean | undefined,
  juryInNomination: ContestWinnerBrief[],
  audienceInNomination: ContestWinnerBrief[]
): PrimaryTrack {
  if (juryVotingEnabled && juryInNomination.length > 0) {
    return 'jury';
  }
  if (audienceInNomination.length > 0) {
    return 'audience';
  }
  return 'jury';
}
