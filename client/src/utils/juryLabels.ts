/** Склонение «N критериев» для подписей жюри. */
export function juryCriteriaWordRu(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'критерий';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'критерия';
  return 'критериев';
}
