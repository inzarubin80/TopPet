/** Часовой пояс для ввода расписания на форме редактирования (IANA). */
export const DEFAULT_SCHEDULE_TIMEZONE = 'Europe/Moscow';

/** Популярные пояса; значение — IANA. */
export const SCHEDULE_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/Moscow', label: 'Москва' },
  { value: 'Europe/Kaliningrad', label: 'Калининград' },
  { value: 'Europe/Samara', label: 'Самара' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург' },
  { value: 'Asia/Omsk', label: 'Омск' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск' },
  { value: 'Asia/Irkutsk', label: 'Иркутск' },
  { value: 'Asia/Yakutsk', label: 'Якутск' },
  { value: 'Asia/Vladivostok', label: 'Владивосток' },
  { value: 'Asia/Magadan', label: 'Магадан' },
  { value: 'Asia/Kamchatka', label: 'Камчатка' },
  { value: 'Europe/Kiev', label: 'Киев' },
  { value: 'Europe/Minsk', label: 'Минск' },
  { value: 'Asia/Almaty', label: 'Алматы' },
  { value: 'Asia/Tashkent', label: 'Ташкент' },
  { value: 'Europe/Berlin', label: 'Берлин' },
  { value: 'Europe/London', label: 'Лондон' },
  { value: 'Europe/Paris', label: 'Париж' },
  { value: 'America/New_York', label: 'Нью-Йорк' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес' },
  { value: 'UTC', label: 'UTC' },
];

/** UTC instant (ISO из API) → строка для datetime-local в заданном поясе. */
export function formatUtcIsoInTimeZone(iso: string | undefined, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Строка datetime-local как «настенные часы» в поясе timeZone → UTC ISO (RFC3339).
 * Перебор ±72 ч от якоря — достаточно для любых практических смещений.
 */
export function zonedLocalStringToUtcIso(local: string, timeZone: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  const h = Number(match[4]);
  const min = Number(match[5]);
  if ([y, mo, d, h, min].some((n) => Number.isNaN(n))) return null;

  const targetY = y;
  const targetMo = mo;
  const targetD = d;
  const targetH = h;
  const targetMin = min;

  function wallInTz(utcMs: number): { y: number; mo: number; d: number; h: number; min: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcMs));
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value || 0);
    return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), min: get('minute') };
  }

  const anchor = Date.UTC(y, mo - 1, d, h, min);
  const windowMs = 72 * 60 * 60 * 1000;
  for (let delta = -windowMs; delta <= windowMs; delta += 60 * 1000) {
    const utcMs = anchor + delta;
    const w = wallInTz(utcMs);
    if (
      w.y === targetY &&
      w.mo === targetMo &&
      w.d === targetD &&
      w.h === targetH &&
      w.min === targetMin
    ) {
      return new Date(utcMs).toISOString();
    }
  }
  return null;
}

/** UTC instant из API → краткая строка для карточек и подписей (пояс организатора). */
export function formatContestInstantForDisplay(iso: string | undefined, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Поля конкурса, достаточные для текстовых строк расписания на карточке и странице. */
export type ContestScheduleSource = {
  schedule_timezone?: string;
  registration_starts_at?: string;
  voting_starts_at?: string;
  voting_ends_at?: string;
};

/** Строки «Регистрация …», «Голосование …» в поясе организатора. */
export function getContestScheduleDisplayLines(c: ContestScheduleSource): string[] {
  const scheduleTz = (c.schedule_timezone || '').trim() || DEFAULT_SCHEDULE_TIMEZONE;
  const fmt = (iso?: string) => formatContestInstantForDisplay(iso, scheduleTz);

  const lines: string[] = [];
  if (c.registration_starts_at && c.voting_starts_at) {
    lines.push(`Регистрация: ${fmt(c.registration_starts_at)} — ${fmt(c.voting_starts_at)}`);
  } else if (c.registration_starts_at) {
    lines.push(`Старт регистрации: ${fmt(c.registration_starts_at)}`);
  } else if (c.voting_starts_at) {
    lines.push(`Приём заявок до: ${fmt(c.voting_starts_at)}`);
  }

  if (c.voting_starts_at && c.voting_ends_at) {
    lines.push(`Голосование: ${fmt(c.voting_starts_at)} — ${fmt(c.voting_ends_at)}`);
  } else if (c.voting_ends_at) {
    lines.push(`Окончание голосования: ${fmt(c.voting_ends_at)}`);
  } else if (c.voting_starts_at && lines.length === 0) {
    lines.push(`Старт голосования: ${fmt(c.voting_starts_at)}`);
  }

  return lines;
}
