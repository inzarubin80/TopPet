import type { JuryCriterionInput } from '../../api/juryCriteriaApi';

/** Заголовок и необязательное отличное от него описание (без дубля title === description). */
export function nominationPrimarySecondary(title: string, description: string): {
  primary: string;
  secondary: string | null;
} {
  const t = title.trim();
  const d = (description || '').trim();
  if (!t && d) {
    return { primary: d, secondary: null };
  }
  if (!d || d === t) {
    return { primary: t, secondary: null };
  }
  return { primary: t, secondary: d };
}

/** Текст про минимум фото для участника; при 1 — не показываем отдельной строкой. */
export function minPhotosAudienceHint(minRaw: number | undefined): string | null {
  const min = minRaw ?? 1;
  if (min <= 1) {
    return null;
  }
  return `В заявке нужно не меньше ${min} фото`;
}

/** Подпись шкалы для участников. */
export function juryScaleAudiencePhrase(
  scaleMin: number,
  scaleMax: number,
  scaleStep: number
): string {
  let s = `Баллы от ${scaleMin} до ${scaleMax}`;
  if (scaleStep !== 1) {
    s += `, шаг ${scaleStep}`;
  }
  return s;
}

export function juryScaleOrganizerPhrase(
  scaleMin: number,
  scaleMax: number,
  scaleStep: number
): string {
  let s = `шкала ${scaleMin}–${scaleMax}`;
  if (scaleStep !== 1) {
    s += `, шаг ${scaleStep}`;
  }
  return s;
}

/** Заголовок критерия и опционально отдельное описание (без дубля). */
export function criterionPrimarySecondary(c: JuryCriterionInput): {
  primary: string;
  secondary: string | null;
} {
  const t = c.title.trim();
  const d = (c.description || '').trim();
  if (!d || d === t) {
    return { primary: t, secondary: null };
  }
  return { primary: t, secondary: d };
}
