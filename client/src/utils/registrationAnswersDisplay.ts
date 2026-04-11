import type { RegistrationField, RegistrationFieldType } from '../types/models';

export type RegistrationAnswerDisplayRow = {
  id: string;
  label: string;
  value: string;
  fieldType: RegistrationFieldType;
  /** Полный ключ в registration_answers (для title при сокращённой подписи). */
  labelTitle?: string;
  /** Ключ есть в ответах, но отсутствует в схеме полей конкурса. */
  isOrphan?: boolean;
};

function isPresent(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === 'boolean') return true;
  if (typeof raw === 'number') return !Number.isNaN(raw);
  return String(raw).trim() !== '';
}

function formatValue(field: RegistrationField, raw: unknown): string {
  const t: RegistrationFieldType = field.field_type;
  if (t === 'boolean') {
    if (raw === true || raw === 'true') return 'Да';
    return 'Нет';
  }
  if (t === 'number') {
    if (typeof raw === 'number') return String(raw);
    if (typeof raw === 'string') {
      const n = Number(raw.replace(',', '.'));
      return Number.isNaN(n) ? raw.trim() : String(n);
    }
  }
  return String(raw ?? '').trim();
}

function shortKeyForLabel(id: string): string {
  const hex = id.replace(/-/g, '');
  if (hex.length === 32 && /^[a-f0-9]+$/i.test(hex)) {
    return id.slice(0, 8);
  }
  return id.length > 16 ? `${id.slice(0, 12)}…` : id;
}

function looksLikeImageUrl(s: string): boolean {
  const t = s.trim();
  if (!t || /\s/.test(t)) return false;
  const lower = t.toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|#|$)/.test(lower);
}

function inferOrphanDisplay(raw: unknown): { value: string; fieldType: RegistrationFieldType } {
  if (raw === true || raw === false) {
    return { value: raw ? 'Да' : 'Нет', fieldType: 'boolean' };
  }
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return { value: String(raw), fieldType: 'number' };
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return { value: '', fieldType: 'string' };
    if (looksLikeImageUrl(t)) {
      return { value: t, fieldType: 'image' };
    }
    if (t.includes('\n')) {
      return { value: t, fieldType: 'textarea' };
    }
    return { value: t, fieldType: 'string' };
  }
  try {
    return { value: JSON.stringify(raw), fieldType: 'textarea' };
  } catch {
    return { value: String(raw), fieldType: 'string' };
  }
}

/**
 * Строки по схеме полей конкурса и «осиротевшие» ключи из registration_answers
 * (нет в списке полей — удалённое поле, миграция и т.п.).
 */
export function registrationAnswersToDisplaySections(
  fields: RegistrationField[],
  answers: Record<string, unknown> | undefined
): { schemaRows: RegistrationAnswerDisplayRow[]; orphanRows: RegistrationAnswerDisplayRow[] } {
  const schemaRows: RegistrationAnswerDisplayRow[] = [];
  const orphanRows: RegistrationAnswerDisplayRow[] = [];

  if (!answers || typeof answers !== 'object') {
    return { schemaRows, orphanRows };
  }

  const fieldIdSet = new Set(fields.map((f) => f.id));

  if (fields.length) {
    const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
    for (const f of sorted) {
      if (!Object.prototype.hasOwnProperty.call(answers, f.id)) continue;
      const raw = answers[f.id];
      if (!isPresent(raw)) continue;
      schemaRows.push({
        id: f.id,
        label: f.label,
        value: formatValue(f, raw),
        fieldType: f.field_type,
        isOrphan: false,
      });
    }
  }

  const orphanKeys = Object.keys(answers).filter((k) => !fieldIdSet.has(k));
  orphanKeys.sort((a, b) => a.localeCompare(b));
  for (const key of orphanKeys) {
    const raw = answers[key];
    if (!isPresent(raw)) continue;
    const { value, fieldType } = inferOrphanDisplay(raw);
    if (!isPresent(value)) continue;
    orphanRows.push({
      id: `orphan:${key}`,
      label: `Доп. поле · ${shortKeyForLabel(key)}`,
      labelTitle: key,
      value,
      fieldType,
      isOrphan: true,
    });
  }

  return { schemaRows, orphanRows };
}

/** Строки для отображения ответов заявки в порядке полей конкурса (только непустые, только схема). */
export function registrationAnswersToDisplayRows(
  fields: RegistrationField[],
  answers: Record<string, unknown> | undefined
): RegistrationAnswerDisplayRow[] {
  return registrationAnswersToDisplaySections(fields, answers).schemaRows;
}
