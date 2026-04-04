import { userCanManageContest } from './contestPermissions';
import type { Contest } from '../types/models';

function contest(createdBy: number): Contest {
  return {
    id: 'c1',
    created_by_user_id: createdBy,
    title: 't',
    description: 'd',
    status: 'draft',
    created_at: '',
    updated_at: '',
  };
}

describe('userCanManageContest', () => {
  it('allows contest_admin when they are the author', () => {
    expect(userCanManageContest(contest(10), 10, { id: 10, role: 'contest_admin' })).toBe(true);
  });

  it('allows author with role user (creator rights)', () => {
    expect(userCanManageContest(contest(10), 10, { id: 10, role: 'user' })).toBe(true);
  });

  it('allows contest_admin when they are not the author', () => {
    expect(userCanManageContest(contest(1), 99, { id: 99, role: 'contest_admin' })).toBe(true);
  });

  it('denies plain user who is not the author', () => {
    expect(userCanManageContest(contest(1), 2, { id: 2, role: 'user' })).toBe(false);
  });
});
