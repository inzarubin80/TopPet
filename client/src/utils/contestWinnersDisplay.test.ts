import { sortContestWinnersByNominationOrder } from './contestWinnersDisplay';
import type { ContestWinnerBrief, Nomination } from '../types/models';

describe('sortContestWinnersByNominationOrder', () => {
  const n1 = '11111111-1111-1111-1111-111111111111';
  const n2 = '22222222-2222-2222-2222-222222222222';

  const nominations: Nomination[] = [
    {
      id: n1,
      contest_id: 'c',
      title: 'A',
      description: '',
      sort_order: 1,
      created_at: '2020-01-01T00:00:00Z',
    },
    {
      id: n2,
      contest_id: 'c',
      title: 'B',
      description: '',
      sort_order: 0,
      created_at: '2020-01-02T00:00:00Z',
    },
  ];

  it('orders by nomination sort_order, not UUID', () => {
    const winners: ContestWinnerBrief[] = [
      { participant_id: 'p1', pet_name: 'One', nomination_id: n1, nomination_title: 'A', score: 5 },
      { participant_id: 'p2', pet_name: 'Two', nomination_id: n2, nomination_title: 'B', score: 7 },
    ];
    const sorted = sortContestWinnersByNominationOrder(winners, nominations);
    expect(sorted.map((w) => w.participant_id)).toEqual(['p2', 'p1']);
  });

  it('returns same reference when nominations missing or single winner', () => {
    const one: ContestWinnerBrief[] = [
      { participant_id: 'p1', pet_name: 'One', nomination_id: n1, nomination_title: 'A', score: 5 },
    ];
    expect(sortContestWinnersByNominationOrder(one, undefined)).toBe(one);
    expect(sortContestWinnersByNominationOrder(one, [])).toBe(one);
  });
});
