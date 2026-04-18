import { userIdsEqual } from './userId';

describe('userIdsEqual', () => {
  it('matches number and string forms of the same id', () => {
    expect(userIdsEqual(42, 42)).toBe(true);
    expect(userIdsEqual(42, '42')).toBe(true);
    expect(userIdsEqual('42', 42)).toBe(true);
  });

  it('rejects different ids and nullish values', () => {
    expect(userIdsEqual(1, 2)).toBe(false);
    expect(userIdsEqual(null, 1)).toBe(false);
    expect(userIdsEqual(1, undefined)).toBe(false);
  });
});
