import {
  formatScheduleInstantCompact,
  formatScheduleRangeCompact,
  getContestScheduleDisplayLines,
} from './scheduleTimezone';

describe('formatScheduleRangeCompact', () => {
  it('same calendar day in timezone shows single date', () => {
    expect(
      formatScheduleRangeCompact('2026-04-05T10:23:00.000Z', '2026-04-05T22:25:00.000Z', 'UTC')
    ).toBe('05.04.2026');
  });

  it('same year different days shortens start', () => {
    expect(
      formatScheduleRangeCompact('2026-04-05T10:25:00.000Z', '2026-04-12T10:22:00.000Z', 'UTC')
    ).toBe('05.04 — 12.04.2026');
  });

  it('different years shows full dates', () => {
    expect(
      formatScheduleRangeCompact('2025-12-31T20:00:00.000Z', '2026-01-02T08:00:00.000Z', 'UTC')
    ).toBe('31.12.2025 — 02.01.2026');
  });
});

describe('formatScheduleInstantCompact', () => {
  it('formats date only', () => {
    expect(formatScheduleInstantCompact('2026-04-05T13:23:00.000Z', 'UTC')).toBe('05.04.2026');
  });
});

describe('getContestScheduleDisplayLines', () => {
  it('builds date-only lines', () => {
    const lines = getContestScheduleDisplayLines({
      schedule_timezone: 'UTC',
      publication_starts_at: '2026-04-05T14:40:00.000Z',
      registration_starts_at: '2026-04-13T10:23:00.000Z',
      voting_starts_at: '2026-04-14T10:25:00.000Z',
      voting_ends_at: '2026-04-30T10:22:00.000Z',
    });
    expect(lines).toEqual([
      'Публикация · 05.04.2026',
      'Регистрация · 13.04 — 14.04.2026',
      'Голосование · 14.04 — 30.04.2026',
    ]);
  });
});
