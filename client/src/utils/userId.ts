/**
 * Сравнение идентификаторов пользователя с учётом возможного расхождения типов
 * (например, number из сессии и string из части ответов API).
 */
export function userIdsEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) {
    return false;
  }
  const na = typeof a === 'number' ? a : Number(a);
  const nb = typeof b === 'number' ? b : Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}
