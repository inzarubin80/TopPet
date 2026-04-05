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
    {
      id: 't1',
      contest_id: 'c',
      sort_order: 3,
      label: 'О себе',
      field_type: 'textarea',
      required: false,
      created_at: '',
    },
    {
      id: 'i1',
      contest_id: 'c',
      sort_order: 4,
      label: 'Фото питомца',
      field_type: 'image',
      required: false,
      created_at: '',
    },
  ];

  it('sorts by sort_order and formats types', () => {
    const rows = registrationAnswersToDisplayRows(fields, {
      s1: 'Москва',
      n1: 3,
      b1: false,
      t1: 'Строка 1\nСтрока 2',
      i1: 'https://example.com/a.png',
    });
    expect(rows.map((r) => r.label)).toEqual([
      'Город',
      'Возраст',
      'Согласие',
      'О себе',
      'Фото питомца',
    ]);
    expect(rows.map((r) => r.value)).toEqual([
      'Москва',
      '3',
      'Нет',
      'Строка 1\nСтрока 2',
      'https://example.com/a.png',
    ]);
    expect(rows.map((r) => r.fieldType)).toEqual([
      'string',
      'number',
      'boolean',
      'textarea',
      'image',
    ]);
  });

  it('skips empty string answers', () => {
    const rows = registrationAnswersToDisplayRows(fields, { s1: '   ', n1: 1 });
    expect(rows.map((r) => r.id)).toEqual(['n1']);
  });
});
