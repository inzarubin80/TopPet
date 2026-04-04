import { registrationAnswersToDisplayRows } from './registrationAnswersDisplay';
import type { RegistrationField } from '../types/models';

describe('registrationAnswersToDisplayRows', () => {
  const fields: RegistrationField[] = [
    {
      id: 'b1',
      contest_id: 'c',
      sort_order: 2,
      label: 'Согласие',
      field_type: 'boolean',
      required: true,
      created_at: '',
    },
    {
      id: 's1',
      contest_id: 'c',
      sort_order: 0,
      label: 'Город',
      field_type: 'string',
      required: false,
      created_at: '',
    },
    {
      id: 'n1',
      contest_id: 'c',
      sort_order: 1,
      label: 'Возраст',
      field_type: 'number',
      required: false,
      created_at: '',
    },
  ];

  it('sorts by sort_order and formats types', () => {
    const rows = registrationAnswersToDisplayRows(fields, {
      s1: 'Москва',
      n1: 3,
      b1: false,
    });
    expect(rows.map((r) => r.label)).toEqual(['Город', 'Возраст', 'Согласие']);
    expect(rows.map((r) => r.value)).toEqual(['Москва', '3', 'Нет']);
  });

  it('skips empty string answers', () => {
    const rows = registrationAnswersToDisplayRows(fields, { s1: '   ', n1: 1 });
    expect(rows.map((r) => r.id)).toEqual(['n1']);
  });
});
