import type { Contest } from '../types/models';
import {
  getJuryChairboardPhaseBlockedMessage,
  juryChairboardContestAllowsRead,
  juryChairboardContestAllowsReadForStatus,
} from './juryChairboardAccess';

describe('juryChairboardContestAllowsReadForStatus', () => {
  it('allows draft and publication', () => {
    expect(juryChairboardContestAllowsReadForStatus('draft')).toBe(true);
    expect(juryChairboardContestAllowsReadForStatus('publication')).toBe(true);
  });
  it('allows registration, voting, finished', () => {
    expect(juryChairboardContestAllowsReadForStatus('registration')).toBe(true);
    expect(juryChairboardContestAllowsReadForStatus('voting')).toBe(true);
    expect(juryChairboardContestAllowsReadForStatus('finished')).toBe(true);
  });
});

describe('getJuryChairboardPhaseBlockedMessage', () => {
  it('returns null when phase allows board', () => {
    const c: Contest = {
      id: 'x',
      created_by_user_id: 1,
      title: 't',
      description: '',
      status: 'draft',
      created_at: '',
      updated_at: '',
    };
    expect(getJuryChairboardPhaseBlockedMessage(c)).toBe(null);
    expect(juryChairboardContestAllowsRead(c)).toBe(true);
  });
});
