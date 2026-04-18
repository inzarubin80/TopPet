import type { Contest } from '../types/models';
import { getEffectiveContestStatus } from './contestEffectiveStatus';

describe('getEffectiveContestStatus', () => {
  it('keeps DB status when no schedule dates', () => {
    const c: Contest = {
      id: 'x',
      created_by_user_id: 1,
      title: 't',
      description: '',
      status: 'registration',
      created_at: '',
      updated_at: '',
    };
    expect(getEffectiveContestStatus(c, new Date('2030-01-01T00:00:00.000Z'))).toBe('registration');
  });

  it('uses schedule over stale draft in DB', () => {
    const reg = new Date('2026-06-01T12:00:00.000Z');
    const c: Contest = {
      id: 'x',
      created_by_user_id: 1,
      title: 't',
      description: '',
      status: 'draft',
      registration_starts_at: reg.toISOString(),
      created_at: '',
      updated_at: '',
    };
    expect(getEffectiveContestStatus(c, new Date(reg.getTime() + 60_000))).toBe('registration');
  });
});
