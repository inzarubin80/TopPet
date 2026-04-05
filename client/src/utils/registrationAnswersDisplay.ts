import type { RegistrationField, RegistrationFieldType } from '../types/models';

export type RegistrationAnswerDisplayRow = {
  id: string;
  label: string;
  value: string;
  fieldType: RegistrationFieldType;
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

/** Строки для отображения ответов заявки в порядке полей конкурса (только непустые). */
export function registrationAnswersToDisplayRows(
  fields: RegistrationField[],
  answers: Record<string, string | number | boolean> | undefined
): RegistrationAnswerDisplayRow[] {
  if (!fields.length || !answers) return [];
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const out: RegistrationAnswerDisplayRow[] = [];
  for (const f of sorted) {
    if (!Object.prototype.hasOwnProperty.call(answers, f.id)) continue;
    const raw = answers[f.id];
    if (!isPresent(raw)) continue;
    out.push({ id: f.id, label: f.label, value: formatValue(f, raw), fieldType: f.field_type });
  }
  return out;
}
