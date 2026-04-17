import { formatJuryTotalScore, juryCriteriaWordRu } from './juryLabels';

describe('formatJuryTotalScore', () => {
  it('formats numeric total for display', () => {
    expect(formatJuryTotalScore(24)).toMatch(/24/);
    expect(formatJuryTotalScore(24.567)).toMatch(/24/);
  });
});

describe('juryCriteriaWordRu', () => {
  it('declines criteria count in Russian', () => {
    expect(juryCriteriaWordRu(1)).toBe('критерий');
    expect(juryCriteriaWordRu(2)).toBe('критерия');
    expect(juryCriteriaWordRu(5)).toBe('критериев');
    expect(juryCriteriaWordRu(11)).toBe('критериев');
    expect(juryCriteriaWordRu(21)).toBe('критерий');
    expect(juryCriteriaWordRu(22)).toBe('критерия');
  });
});
